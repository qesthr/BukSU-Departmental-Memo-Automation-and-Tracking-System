const axios = require('axios');

const ABSTRACT_URL = process.env.ABSTRACT_EMAIL_API_URL || 'https://emailreputation.abstractapi.com/v1/';

async function validateEmailDeliverability(email) {
    const apiKey = process.env.ABSTRACT_EMAIL_API_KEY;
    console.log('[EMAIL VALIDATION]', { email, hasKey: !!apiKey, url: ABSTRACT_URL });
    if (!apiKey) {
        console.warn('[EMAIL VALIDATION] API key not configured, skipping validation');
        return { usable: true, reason: 'validation_disabled' };
    }
    try {
        const res = await axios.get(ABSTRACT_URL, {
            params: { api_key: apiKey, email }
        });
        const data = res.data || {};
        console.log('[EMAIL VALIDATION] Abstract response:', JSON.stringify(data, null, 2));

        // Parse Abstract v1 API response structure
        const isValidFormat = data.email_deliverability?.is_format_valid !== false;
        const deliverabilityStatus = String(data.email_deliverability?.status || 'UNKNOWN').toUpperCase();
        const isCatchAll = data.email_quality?.is_catchall === true;
        const isDisposable = data.email_quality?.is_disposable === true;
        const isRole = data.email_quality?.is_role === true;
        const hasMx = data.email_deliverability?.is_mx_valid === true;

        const emailDomain = String(email).split('@')[1] || '';
        const isBukSu = emailDomain.endsWith('buksu.edu.ph') || emailDomain.endsWith('student.buksu.edu.ph');
        const whitelist = String(process.env.EMAIL_VALIDATION_DOMAIN_WHITELIST || '')
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
        const isWhitelisted = isBukSu || whitelist.includes(emailDomain.toLowerCase());

        // Policy control via env: STRICT (default) or MODERATE
        const policy = (process.env.EMAIL_VALIDATION_POLICY || 'STRICT').toUpperCase();
        console.log('[EMAIL VALIDATION]', { email, domain: emailDomain, isBukSu, isWhitelisted, policy, deliverabilityStatus, isValidFormat, isDisposable, hasMx, isCatchAll });

        // Block disposable or invalid format always
        if (!isValidFormat || isDisposable) {
            return { usable: false, reason: 'invalid_or_disposable', raw: data };
        }

        if (policy === 'MODERATE' || isWhitelisted) {
            // Allow DELIVERABLE or UNKNOWN when MX exists; still block UNDELIVERABLE
            if (deliverabilityStatus === 'UNDELIVERABLE') {
                // If domain is whitelisted and MX exists, allow with warning
                if (isWhitelisted && hasMx) {
                    if (process.env.DEBUG_EMAIL_VALIDATION === '1') {
                        console.warn('[Abstract Validation][WHITELIST OVERRIDE]', { email, deliverabilityStatus, hasMx });
                    }
                    return { usable: true, reason: 'whitelist_override', warnings: ['abstract_undeliverable'], deliverability: deliverabilityStatus, raw: data };
                }
                return { usable: false, reason: 'undeliverable', raw: data };
            }
            // Accept DELIVERABLE, or UNKNOWN when MX/catchall exists
            if (deliverabilityStatus === 'DELIVERABLE' || (deliverabilityStatus === 'UNKNOWN' && (hasMx || isCatchAll))) {
                if (process.env.DEBUG_EMAIL_VALIDATION === '1') {
                    console.log('[Abstract Validation][MODERATE]', { email, deliverabilityStatus, isCatchAll, hasMx });
                }
                return { usable: true, reason: 'ok_moderate', warnings: [isCatchAll ? 'catch_all' : null].filter(Boolean), deliverability: deliverabilityStatus, raw: data };
            }
            return { usable: false, reason: 'risky', raw: data };
        }

        // STRICT policy: only allow DELIVERABLE
        if (deliverabilityStatus !== 'DELIVERABLE') {
            return { usable: false, reason: deliverabilityStatus.toLowerCase(), raw: data };
        }

        const warnings = [];
        if (isCatchAll) {warnings.push('catch_all');}
        if (isDisposable) {warnings.push('disposable');}
        if (isRole) {warnings.push('role_based');}

        if (process.env.DEBUG_EMAIL_VALIDATION === '1') {
            console.log('[Abstract Validation]', { email, deliverabilityStatus, warnings, isCatchAll, isRole });
        }
        return { usable: true, reason: 'ok', warnings, deliverability: deliverabilityStatus, raw: data };
    } catch (err) {
        return { usable: true, reason: 'validation_error', error: err.message };
    }
}

module.exports = { validateEmailDeliverability };


