const defaultSecretaryControls = Object.freeze({
    addSignature: true,
    sendMemo: true,
    archiveMemo: true,
    addEvent: true,
    attachFiles: true,
    changePassword: true
});

function normalizeSecretaryControls(input) {
    const normalized = { ...defaultSecretaryControls };
    if (!input || typeof input !== 'object') {
        return normalized;
    }
    for (const key of Object.keys(normalized)) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            normalized[key] = !!input[key];
        }
    }
    return normalized;
}

function resolveSecretaryControls(user) {
    if (!user || user.role !== 'secretary') {
        return { ...defaultSecretaryControls };
    }
    return normalizeSecretaryControls(user.secretaryControls);
}

module.exports = {
    defaultSecretaryControls,
    normalizeSecretaryControls,
    resolveSecretaryControls
};

