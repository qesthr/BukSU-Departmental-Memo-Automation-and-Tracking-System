document.addEventListener('DOMContentLoaded', () => {
    const composeBtn = document.querySelector('.compose-btn');
    const composeModal = document.getElementById('composeModal');
    const composeForm = document.getElementById('composeForm');
    const folderItems = document.querySelectorAll('.folder-item');
    const memoList = document.getElementById('memoList');
    const emptyState = document.getElementById('emptyState');
    const memoViewer = document.getElementById('memoViewer');
    const backBtn = document.getElementById('backBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const starBtn = document.getElementById('starBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const archiveBtn = document.getElementById('archiveBtn');
    const acknowledgeBtn = document.getElementById('acknowledgeBtn');
    const reminderBtn = document.getElementById('reminderBtn');
    const memoCounter = document.getElementById('memoCounter');
    const refreshBtn = document.getElementById('refreshBtn');
    const selectDropdownBtn = document.getElementById('selectDropdownBtn');
    const selectDropdownMenu = document.getElementById('selectDropdownMenu');
    const selectDropdownWrapper = document.querySelector('.select-dropdown-wrapper');
    const deptFilterDropdown = document.getElementById('deptFilterDropdown');
    const priorityFilterDropdown = document.getElementById('priorityFilterDropdown');
    const sortDropdown = document.getElementById('sortDropdown');
    const dateFilterInput = document.getElementById('dateFilterInput');
    const clearDateFilter = document.getElementById('clearDateFilter');
    const globalSearchInput = document.getElementById('globalSearchInput');

    let currentFolder = 'inbox';
    let currentDeptFilter = 'all';
    let currentPriorityFilter = 'all';
    let currentSort = 'newest';
    let currentDateFilter = null;
    let currentSearchTerm = '';
    let memos = [];
    let filteredMemos = [];
    let currentMemoIndex = -1;
    let currentMemoId = null;

    if (downloadBtn) {
        downloadBtn.disabled = true;
    }
    // Initialize
    // Only fetch memos if we're on a page with memo list (not dashboard)
    if (memoList || !window.isDashboardPage) {
        fetchMemos();
    }
    loadDepartments();
    preloadTemplatesAndSignatures();

    // Initialize Lucide icons for date filter clear button
    if (typeof lucide !== 'undefined' && clearDateFilter) {
        // eslint-disable-next-line no-undef
        lucide.createIcons();
    }

    // Compose button
    if (composeBtn && composeModal) {
        composeBtn.addEventListener('click', () => {
            openModal(composeModal);
            // Reinitialize Lucide icons
            if (typeof lucide !== 'undefined') {
                // eslint-disable-next-line no-undef
                lucide.createIcons();
            }
            // Ensure attachment handlers are initialized when modal opens
            setTimeout(() => {
                setupAttachmentHandlers();
                // Ensure department dropdown is initialized when modal opens
                const modal = document.getElementById('composeModal');
                if (modal) {
                    attachTemplateHandlers(modal);
                    // Initialize secretary department checkbox handler (this will handle canCrossSend secretaries)
                    initSecretaryDeptCheckbox(modal);
                    // For admins, initialize department dropdown
                    const isSecretary = window.currentUser && window.currentUser.role === 'secretary';
                    const canCrossSend = window.currentUser?.canCrossSend || false;
                    if (!isSecretary || (isSecretary && canCrossSend)) {
                        // Wait a bit more to ensure DOM is fully rendered, especially for secretary wrapper
                        setTimeout(() => {
                            loadDepartments();
                        }, 100);
                    }
                }
            }, 200);
        });
    }

    // Calendar/Schedule button handler
    const calendarBtn = document.getElementById('calendarBtn');
    const scheduleModal = document.getElementById('scheduleModal');
    if (calendarBtn && scheduleModal) {
        calendarBtn.addEventListener('click', () => {
            // Load current values if any
            const memoDate = document.getElementById('memoDate');
            const memoTime = document.getElementById('memoTime');
            const allDayEvent = document.getElementById('allDayEvent');
            const scheduleStartDate = document.getElementById('scheduleStartDate');
            const scheduleStartTime = document.getElementById('scheduleStartTime');
            const scheduleEndDate = document.getElementById('scheduleEndDate');
            const scheduleEndTime = document.getElementById('scheduleEndTime');
            const scheduleAllDay = document.getElementById('scheduleAllDay');

            // Legacy fields for backward compatibility
            const scheduleDate = document.getElementById('scheduleDate');
            const scheduleTime = document.getElementById('scheduleTime');

            // Load Start values
            if (memoDate && memoDate.value) {
                if (scheduleStartDate) {
                    scheduleStartDate.value = memoDate.value;
                }
                if (scheduleDate) {
                    scheduleDate.value = memoDate.value; // Legacy
                }
            }
            if (memoTime && memoTime.value) {
                if (scheduleStartTime) {
                    scheduleStartTime.value = memoTime.value;
                }
                if (scheduleTime) {
                    scheduleTime.value = memoTime.value; // Legacy
                }
            }

            // Set End date to same as Start date by default, End time to 1 hour after Start time
            if (scheduleStartDate && scheduleStartDate.value && scheduleEndDate) {
                scheduleEndDate.value = scheduleStartDate.value;
            }
            if (scheduleStartTime && scheduleStartTime.value && scheduleEndTime) {
                const [hours, minutes] = scheduleStartTime.value.split(':');
                const endHour = (parseInt(hours, 10) + 1) % 24;
                scheduleEndTime.value = `${String(endHour).padStart(2, '0')}:${minutes}`;
            }

            if (allDayEvent) {
                scheduleAllDay.checked = allDayEvent.value === 'true';
                if (scheduleAllDay.checked) {
                    if (scheduleStartTime) {
                        scheduleStartTime.disabled = true;
                    }
                    if (scheduleEndTime) {
                        scheduleEndTime.disabled = true;
                    }
                    if (scheduleTime) {
                        scheduleTime.disabled = true; // Legacy
                    }
                }
            }

            openModal(scheduleModal);
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
    }

    // Handle all-day checkbox in schedule modal
    const scheduleAllDay = document.getElementById('scheduleAllDay');
    const scheduleStartTime = document.getElementById('scheduleStartTime');
    const scheduleEndTime = document.getElementById('scheduleEndTime');
    const scheduleTime = document.getElementById('scheduleTime'); // Legacy
    if (scheduleAllDay) {
        scheduleAllDay.addEventListener('change', (e) => {
            const isAllDay = e.target.checked;
            if (scheduleStartTime) {
                scheduleStartTime.disabled = isAllDay;
            }
            if (scheduleEndTime) {
                scheduleEndTime.disabled = isAllDay;
            }
            if (scheduleTime) {
                scheduleTime.disabled = isAllDay; // Legacy
            }

            if (isAllDay) {
                if (scheduleStartTime) {
                    scheduleStartTime.value = '';
                }
                if (scheduleEndTime) {
                    scheduleEndTime.value = '';
                }
                if (scheduleTime) {
                    scheduleTime.value = ''; // Legacy
                }
            }
        });
    }

    // Schedule modal save and clear button handlers
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');
    const clearScheduleBtn = document.getElementById('clearScheduleBtn');
    if (saveScheduleBtn) {
        saveScheduleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            saveSchedule();
        });
    }
    if (clearScheduleBtn) {
        clearScheduleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearSchedule();
            if (scheduleModal) {
                scheduleModal.style.display = 'none';
            }
        });
    }

    // Preload templates and signatures that the current user can use
    async function preloadTemplatesAndSignatures(){
        try{
            const [tplRes, sigRes] = await Promise.all([
                fetch('/api/log/memos/templates', { credentials: 'same-origin' }),
                fetch('/api/log/memos/signatures/allowed', { credentials: 'same-origin' })
            ]);
            const tplData = await tplRes.json().catch(()=>({templates:[]}));
            const sigData = await sigRes.json().catch(()=>({signatures:[]}));
            window.memoTemplates = tplData.templates || [];
            window.allowedSignatures = sigData.signatures || [];
        }catch(e){ /* ignore */ }
    }

    function renderSignatoryBlocks(modal, selectedSignatureIds){
        const section = modal.querySelector('#signatorySection');
        if (!section) {return;}
        section.innerHTML = '';
        if (!Array.isArray(selectedSignatureIds) || selectedSignatureIds.length === 0 || selectedSignatureIds.includes('none')) {
            section.style.display = 'none';
            return;
        }
        // Filter out 'none' and get signatures
        const validIds = selectedSignatureIds.filter(id => id !== 'none');
        const sigs = (window.allowedSignatures||[]).filter(s => validIds.includes(s.id||s._id));
        sigs.forEach(sig => {
            const name = sig.displayName || sig.roleTitle || '';
            const title = sig.roleTitle || '';
            const imgSrc = sig.imageUrl || '';
            const sigId = sig.id || sig._id || '';
            const block = document.createElement('div');
            block.className = 'signatory-block';
            block.innerHTML = `
                ${ imgSrc ? `<img class="signatory-signature" src="${imgSrc}" alt="${name}" onerror="this.style.display='none'">` : `<div style="height:60px;"></div>` }
                <div class="signatory-name">${name}</div>
                <div class="signatory-title">${title}</div>
                <input type="hidden" class="signatory-meta" data-signature-id="${sigId}" data-role="${title}">
            `;
            section.appendChild(block);
        });
        section.style.display = 'grid';
    }

    // Handle archive signature action
    async function handleArchiveSignature(signatureId, signatureName, container, refreshCallback) {
        if (typeof Swal === 'undefined') {
            // Fallback if SweetAlert2 is not available
            if (confirm(`Are you sure you want to archive "${signatureName}"?`)) {
                await performArchiveSignature(signatureId, container, refreshCallback);
            }
            return;
        }

        Swal.fire({
            title: 'Archive Signature',
            html: `Are you sure you want to archive <strong>${signatureName}</strong>?<br><br>Archived signatures will be hidden from the template dropdown.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Archive',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#6b7280',
            reverseButtons: true,
            focusConfirm: false,
            focusCancel: true,
            allowOutsideClick: false,
            allowEscapeKey: true,
            showLoaderOnConfirm: true,
            customClass: {
                container: 'swal2-container-compose-modal'
            },
            preConfirm: async () => {
                return await performArchiveSignature(signatureId, container, refreshCallback);
            }
        }).then((result) => {
            if (result.isConfirmed && result.value?.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Archived',
                    text: `Signature "${signatureName}" has been archived successfully`,
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end',
                    customClass: {
                        container: 'swal2-container-compose-modal'
                    }
                });
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                // User cancelled, do nothing
            }
        });
    }

    // Perform the actual archive API call
    async function performArchiveSignature(signatureId, container, refreshCallback) {
        try {
            const response = await fetch(`/api/signatures/${signatureId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                let errorMessage = 'Failed to archive signature';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (err) {
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Failed to archive signature');
            }

            // Refresh the signature dropdown
            if (refreshCallback && typeof refreshCallback === 'function') {
                await refreshCallback();
            }

            return { success: true };
        } catch (error) {
            if (typeof Swal !== 'undefined') {
                Swal.showValidationMessage(error.message || 'Failed to archive signature. Please try again.');
            } else {
                alert(error.message || 'Failed to archive signature. Please try again.');
            }
            return { success: false };
        }
    }

    // Expose attachTemplateHandlers globally for admin view
    window.attachTemplateHandlers = function(modal){
        const dropdownBtn = modal.querySelector('#templateDropdownBtn');
        const dropdownMenu = modal.querySelector('#templateDropdownMenu');
        const container = modal.querySelector('#templateSignaturesContainer');
        const addBtn = modal.querySelector('#addSignatureBtn');

        console.log('attachTemplateHandlers called', { dropdownBtn, dropdownMenu, container }); // Debug log

        if (!dropdownBtn || !dropdownMenu || !container) {
            console.warn('Template dropdown elements not found', { dropdownBtn: !!dropdownBtn, dropdownMenu: !!dropdownMenu, container: !!container });
            return;
        }

        const dropdown = dropdownBtn.closest('.custom-dropdown');
        if (!dropdown) {
            console.warn('Template dropdown parent .custom-dropdown not found');
            return;
        }

        console.log('Template dropdown found:', dropdown); // Debug log

        // Load signatures and populate dropdown
        async function populateTemplateDropdown(){
            // Refresh signatures when modal opens to ensure we have the latest data
            try {
                const sigRes = await fetch('/api/log/memos/signatures/allowed', { credentials: 'same-origin' });
                const sigData = await sigRes.json().catch(()=>({signatures:[]}));
                if (sigData.success && sigData.signatures) {
                    window.allowedSignatures = sigData.signatures || [];
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('Failed to refresh signatures:', e);
                // Fall back to cached signatures
            }

            const signatures = window.allowedSignatures || [];
            container.innerHTML = '';
            if (signatures.length === 0) {
                container.innerHTML = '<div style="padding:8px; color:#6b7280; font-size:12px; text-align:center;">No signatures available</div>';
            } else {
                // Check if user is admin (for archive button visibility)
                const isAdmin = window.currentUser && window.currentUser.role === 'admin';

                signatures.forEach(sig => {
                    const label = document.createElement('label');
                    label.className = 'dept-checkbox-label';
                    label.style.cursor = 'pointer';
                    label.style.display = 'flex';
                    label.style.alignItems = 'center';
                    label.style.justifyContent = 'space-between';
                    label.style.padding = '4px 8px';
                    label.style.margin = '2px 0';
                    label.style.borderRadius = '4px';
                    label.style.transition = 'background-color 0.2s';

                    label.innerHTML = `
                        <div style="display: flex; align-items: center; flex: 1; cursor: pointer;">
                            <input type="checkbox" class="template-checkbox" value="${sig.id||sig._id}" style="margin-right: 8px;">
                            <span style="flex: 1;">${sig.displayName || sig.roleTitle}</span>
                        </div>
                        ${isAdmin ? `
                            <button type="button" class="signature-archive-btn" data-signature-id="${sig.id||sig._id}" data-signature-name="${sig.displayName || sig.roleTitle}"
                                style="background: none; border: none; color: #f59e0b; cursor: pointer; padding: 4px 6px; border-radius: 4px; opacity: 0.7; transition: all 0.2s; display: flex; align-items: center;"
                                title="Archive signature">
                                <i data-lucide="archive" style="width: 16px; height: 16px;"></i>
                            </button>
                        ` : ''}
                    `;

                    // Add hover effect
                    label.addEventListener('mouseenter', () => {
                        label.style.backgroundColor = '#f3f4f6';
                    });
                    label.addEventListener('mouseleave', () => {
                        label.style.backgroundColor = 'transparent';
                    });

                    container.appendChild(label);
                });

                // Initialize Lucide icons for archive buttons
                if (typeof lucide !== 'undefined') {
                    setTimeout(() => {
                        lucide.createIcons();
                    }, 100);
                }

                // Attach archive button handlers
                if (isAdmin) {
                    container.querySelectorAll('.signature-archive-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const signatureId = btn.getAttribute('data-signature-id');
                            const signatureName = btn.getAttribute('data-signature-name');
                            await handleArchiveSignature(signatureId, signatureName, container, populateTemplateDropdown);
                        });
                    });
                }
            }
        }

        // Populate dropdown when modal opens (async)
        populateTemplateDropdown();

        // Toggle dropdown
        // Remove any existing event listeners to prevent duplicates
        const newDropdownBtn = dropdownBtn.cloneNode(true);
        dropdownBtn.parentNode.replaceChild(newDropdownBtn, dropdownBtn);

        // Update reference to the new button
        const currentDropdownBtn = newDropdownBtn;

        currentDropdownBtn.addEventListener('click', (e)=>{
            e.preventDefault();
            e.stopPropagation();
            console.log('Template dropdown button clicked'); // Debug log
            // Close department dropdown if open
            const deptBtn = modal.querySelector('#deptDropdownBtn');
            let deptDropdown = deptBtn ? deptBtn.closest('.custom-dropdown') : null;
            // Also check secretary wrapper location
            if (!deptDropdown) {
                const secretaryWrapper = modal.querySelector('#secretaryDeptDropdownWrapper');
                if (secretaryWrapper) {
                    const secretaryDeptBtn = secretaryWrapper.querySelector('#deptDropdownBtn');
                    deptDropdown = secretaryDeptBtn ? secretaryDeptBtn.closest('.custom-dropdown') : null;
                }
            }
            if (deptDropdown && deptDropdown.classList.contains('open')) {
                deptDropdown.classList.remove('open');
                // Also hide the department menu explicitly
                const deptMenu = deptDropdown.querySelector('#deptDropdownMenu');
                if (deptMenu) {
                    deptMenu.style.display = 'none';
                    deptMenu.style.visibility = 'hidden';
                    deptMenu.style.opacity = '0';
                }
            }
            const isOpen = dropdown.classList.contains('open');
            console.log('Dropdown open state before toggle:', isOpen); // Debug log
            dropdown.classList.toggle('open');
            const isOpenAfter = dropdown.classList.contains('open');
            console.log('Dropdown open state after toggle:', isOpenAfter); // Debug log
            console.log('Dropdown element:', dropdown); // Debug log
            console.log('Menu element:', dropdownMenu); // Debug log

            // Force display if open class is added (fallback if CSS doesn't apply)
            if (isOpenAfter) {
                dropdownMenu.style.display = 'block';
                dropdownMenu.style.visibility = 'visible';
                dropdownMenu.style.opacity = '1';
                dropdownMenu.style.zIndex = '100002';
            } else {
                dropdownMenu.style.display = 'none';
            }

            // Force display check after a brief delay to ensure CSS has applied
            setTimeout(() => {
                const computedStyle = window.getComputedStyle(dropdownMenu);
                console.log('Menu computed style after toggle:', {
                    display: computedStyle.display,
                    visibility: computedStyle.visibility,
                    opacity: computedStyle.opacity,
                    zIndex: computedStyle.zIndex,
                    hasOpenClass: dropdown.classList.contains('open'),
                    parentHasOpenClass: dropdown.classList.contains('open')
                }); // Debug log

                // If still not visible, force it
                if (dropdown.classList.contains('open') && computedStyle.display === 'none') {
                    console.warn('Template dropdown menu not showing, forcing display');
                    dropdownMenu.style.display = 'block';
                    dropdownMenu.style.visibility = 'visible';
                    dropdownMenu.style.opacity = '1';
                    dropdownMenu.style.zIndex = '100002';
                }
            }, 10);
        });

        // Close on outside click - use a named function so we can remove it if needed
        const handleOutsideClick = (e)=>{
            // Don't close if clicking on the dropdown button or inside the dropdown
            // Also check if clicking on any element within the template dropdown structure
            const isClickInside = dropdown.contains(e.target) ||
                                 currentDropdownBtn.contains(e.target) ||
                                 dropdownMenu.contains(e.target) ||
                                 e.target.closest('#templateDropdownMenu') ||
                                 e.target.closest('#templateDropdownBtn');

            if (isClickInside){
                return;
            }

            // Only close if dropdown is actually open
            if (dropdown.classList.contains('open')) {
                dropdown.classList.remove('open');
                // Also hide the menu explicitly
                if (dropdownMenu) {
                    dropdownMenu.style.display = 'none';
                    dropdownMenu.style.visibility = 'hidden';
                    dropdownMenu.style.opacity = '0';
                }
            }
        };

        // Remove any existing listener and add new one with capture phase to handle it first
        document.removeEventListener('click', handleOutsideClick, true);
        document.addEventListener('click', handleOutsideClick, true);

        // Handle checkbox changes (multiple selection)
        let selectedIds = [];
        dropdownMenu.addEventListener('change', (e)=>{
            if (e.target.classList.contains('template-checkbox')){
                const checkboxes = dropdownMenu.querySelectorAll('.template-checkbox');
                selectedIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

                // If "none" is checked, uncheck all others and vice versa
                const noneCheckbox = dropdownMenu.querySelector('input[value="none"]');
                if (e.target.value === 'none' && e.target.checked){
                    // Uncheck all signature checkboxes
                    checkboxes.forEach(cb => {
                        if (cb.value !== 'none') {cb.checked = false;}
                    });
                    selectedIds = ['none'];
                } else if (e.target.value !== 'none' && e.target.checked){
                    // Uncheck "none" if a signature is selected
                    if (noneCheckbox) {noneCheckbox.checked = false;}
                    selectedIds = selectedIds.filter(id => id !== 'none');
                }

                // Update selected IDs after "none" logic
                selectedIds = Array.from(dropdownMenu.querySelectorAll('.template-checkbox:checked')).map(cb => cb.value);

                renderSignatoryBlocks(modal, selectedIds);

                // Update button text
                const placeholder = dropdownBtn.querySelector('.template-placeholder');
                if (placeholder){
                    const validIds = selectedIds.filter(id => id !== 'none');
                    if (validIds.length === 0){
                        placeholder.textContent = 'Template: None';
                    } else if (validIds.length === 1){
                        const sig = (window.allowedSignatures||[]).find(s => (s.id||s._id) === validIds[0]);
                        placeholder.textContent = `Template: ${sig?.displayName || sig?.roleTitle || 'Selected'}`;
                    } else {
                        placeholder.textContent = `${validIds.length} signatures selected`;
                    }
                }
            }
        });

        // Add Signature button handler
        if (addBtn){
            addBtn.addEventListener('click', (e)=>{
                e.preventDefault();
                e.stopPropagation();
                const addModal = document.getElementById('addSignatureModal');
                if (addModal){
                    addModal.style.display = 'flex';
                }
            });
        }

        // Reset on modal open
        const placeholder = dropdownBtn.querySelector('.template-placeholder');
        if (placeholder) {placeholder.textContent = 'Template: None';}
        const noneCheckbox = dropdownMenu.querySelector('input[value="none"]');
        if (noneCheckbox) {noneCheckbox.checked = true;}
        dropdownMenu.querySelectorAll('.template-checkbox').forEach(cb => {
            if (cb.value !== 'none') {cb.checked = false;}
        });
        renderSignatoryBlocks(modal, ['none']);

        const previewBtn = modal.querySelector('#previewMemoBtn');
        if (previewBtn){
            // Remove any existing event listeners by cloning
            const newPreviewBtn = previewBtn.cloneNode(true);
            previewBtn.parentNode.replaceChild(newPreviewBtn, previewBtn);

            newPreviewBtn.addEventListener('click', async (e)=>{
                e.preventDefault();
                e.stopPropagation();
                try{
                    console.log('Preview button clicked'); // Debug log
                    const payload = collectMemoPayload(modal, { preview: true });
                    // If there are image attachments selected but not yet uploaded, upload for preview
                    if (Array.isArray(selectedFiles) && selectedFiles.length > 0){
                        const imageFiles = selectedFiles.filter(f => (f.type||'').startsWith('image/'));
                        if (imageFiles.length){
                            const uploaded = [];
                            for (const img of imageFiles){
                                const fd = new FormData();
                                fd.append('image', img);
                                try{
                                    const up = await fetch('/api/log/upload-image', { method: 'POST', body: fd, credentials: 'same-origin' });
                                    const upData = await up.json().catch(()=>({}));
                                    if (up.ok && upData?.url){ uploaded.push(upData.url); }
                                }catch(e){ /* ignore preview upload errors */ }
                            }
                            if (uploaded.length){ payload.inlineImages = uploaded; }
                        }
                    }
                    const res = await fetch('/api/log/memos/preview', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin', body: JSON.stringify(payload)
                    });

                    if (!res.ok) {
                        const errorText = await res.text().catch(() => 'Unknown error');
                        console.error('Preview API error:', res.status, errorText);
                        throw new Error(`Preview failed: ${res.status} ${errorText}`);
                    }

                    const data = await res.json().catch(()=>({}));
                    console.log('Preview response:', data); // Debug log

                    if (data?.previewUrl || data?.html){
                        const overlay = document.getElementById('previewOverlay');
                        const frame = document.getElementById('previewFrame');
                        const closeBtn = document.querySelector('.close-preview');
                        if (overlay && frame){
                            if (data.html){
                                // Prefer srcdoc to avoid browser blocking data: URLs
                                frame.removeAttribute('src');
                                frame.srcdoc = data.html;
                            } else {
                                frame.removeAttribute('srcdoc');
                                frame.src = data.previewUrl;
                            }
                            overlay.style.display = 'flex';
                            if (closeBtn){
                                closeBtn.onclick = () => { overlay.style.display = 'none'; frame.removeAttribute('src'); frame.removeAttribute('srcdoc'); };
                            }
                            overlay.addEventListener('click', (e)=>{
                                if (e.target === overlay){ overlay.style.display = 'none'; frame.removeAttribute('src'); frame.removeAttribute('srcdoc'); }
                            });
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Preview container missing'
                            });
                        }
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Preview Unavailable',
                            text: data.message || 'Preview unavailable'
                        });
                    }
                }catch(err){
                    console.error('Preview error:', err);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: err.message || 'Preview failed. Please check the console for details.'
                    });
                }
            });
        }
    }

    function collectMemoPayload(modal, opts){
        // Extract only compose form data - no UI elements
        const subject = modal.querySelector('#subject')?.value || '';
        const contentEl = modal.querySelector('#content');
        let content = '';
        if (contentEl) {
            // Get the raw value from textarea - ensure it's plain text
            content = contentEl.value || '';
            // If somehow innerHTML or textContent is being used, get the value directly
            if (typeof content !== 'string') {
                content = String(content);
            }
            // Strip any HTML tags that might have been accidentally included
            content = content.replace(/<[^>]*>/g, '');
            // Remove any form elements that might be in the content string
            content = content.replace(/<input[^>]*>/gi, '')
                             .replace(/<select[^>]*>.*?<\/select>/gi, '')
                             .replace(/<button[^>]*>.*?<\/button>/gi, '');
        }
        const priority = modal.querySelector('#prioritySelect')?.value || 'medium';
        const departments = (modal.querySelector('#selectedDepartments')?.value || '').split(',').filter(Boolean);
        const selectedCheckboxes = Array.from(modal.querySelectorAll('.template-checkbox:checked'));
        const selectedSignatureIds = selectedCheckboxes.map(cb => cb.value).filter(id => id !== 'none');
        const signatures = Array.from(modal.querySelectorAll('.signatory-meta')).map(i=>({ role: i.dataset.role, signatureId: i.getAttribute('data-signature-id')||null }));

        // Collect recipient information (To field) - only from compose form
        let recipients = [];
        if (window.recipientData && Array.isArray(window.recipientData)) {
            recipients = window.recipientData.map(u => ({
                name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
                email: u.email
            }));
        }

        return {
            subject,
            content,
            priority,
            departments,
            recipients,
            template: selectedSignatureIds.length > 0 ? selectedSignatureIds.join(',') : 'none',
            signatures,
            preview: !!opts?.preview
        };
    }

    // Add Signature form handler
    const addSignatureForm = document.getElementById('addSignatureForm');

    // Update file name display when file is selected
    const signatureImageInput = document.getElementById('signatureImage');
    const fileNameDisplay = document.getElementById('fileName');
    if (signatureImageInput && fileNameDisplay) {
        signatureImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.textContent = file.name;
                fileNameDisplay.style.color = '#059669';
                fileNameDisplay.style.fontWeight = '500';
            } else {
                fileNameDisplay.textContent = 'No file chosen';
                fileNameDisplay.style.color = '#6b7280';
                fileNameDisplay.style.fontWeight = 'normal';
            }
        });
    }

    if (addSignatureForm){
        addSignatureForm.addEventListener('submit', async (e)=>{
            e.preventDefault();
            const form = e.target;
            const nameInput = form.querySelector('#signatureName');
            const titleInput = form.querySelector('#signatureTitle');
            const imageInput = form.querySelector('#signatureImage');
            const submitBtn = form.querySelector('button[type="submit"]');

            if (!nameInput || !titleInput || !imageInput || !imageInput.files[0]){
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Fields',
                    text: 'Please fill all fields including signature image'
                });
                return;
            }

            const formData = new FormData();
            formData.append('displayName', nameInput.value.trim());
            formData.append('roleTitle', titleInput.value.trim());
            formData.append('image', imageInput.files[0]);

            if (submitBtn) {submitBtn.disabled = true;}

            try{
                const res = await fetch('/api/signatures/', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                const data = await res.json().catch(()=>({}));
                if (res.ok && data.success){
                    // Reload signatures
                    await preloadTemplatesAndSignatures();
                    // Refresh template dropdown in all open compose modals
                    const composeModal = document.getElementById('composeModal');
                    if (composeModal){
                        const container = composeModal.querySelector('#templateSignaturesContainer');
                        if (container){
                            // Refresh signatures from API to get the latest
                            try {
                                const sigRes = await fetch('/api/log/memos/signatures/allowed', { credentials: 'same-origin' });
                                const sigData = await sigRes.json().catch(()=>({signatures:[]}));
                                if (sigData.success && sigData.signatures) {
                                    window.allowedSignatures = sigData.signatures || [];
                                }
                            } catch (e) {
                                // eslint-disable-next-line no-console
                                console.warn('Failed to refresh signatures after adding:', e);
                            }

                            const signatures = window.allowedSignatures || [];
                            container.innerHTML = '';
                            if (signatures.length === 0) {
                                container.innerHTML = '<div style="padding:8px; color:#6b7280; font-size:12px; text-align:center;">No signatures available</div>';
                            } else {
                                signatures.forEach(sig => {
                                    const label = document.createElement('label');
                                    label.className = 'dept-checkbox-label';
                                    label.style.cursor = 'pointer';
                                    label.innerHTML = `
                                        <input type="checkbox" class="template-checkbox" value="${sig.id||sig._id}">
                                        <span>${sig.displayName || sig.roleTitle}</span>
                                    `;
                                    container.appendChild(label);
                                });
                            }
                        }
                    }
                    // Close modal and reset form
                    const addModal = document.getElementById('addSignatureModal');
                    if (addModal) {addModal.style.display = 'none';}
                    form.reset();
                    // Reset file name display
                    if (fileNameDisplay) {
                        fileNameDisplay.textContent = 'No file chosen';
                        fileNameDisplay.style.color = '#6b7280';
                        fileNameDisplay.style.fontWeight = 'normal';
                    }
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Signature added successfully!'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message || 'Failed to add signature'
                    });
                }
            }catch(err){
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error adding signature'
                });
            }finally{
                if (submitBtn) {submitBtn.disabled = false;}
            }
        });
    }

    // Folder switching
    folderItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            folderItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentFolder = item.dataset.folder;
            // Reset search when switching folders
            if (globalSearchInput) {
                globalSearchInput.value = '';
                currentSearchTerm = '';
            }
            fetchMemos();
        });
    });

    // Department filtering via dropdown
    if (deptFilterDropdown) {
        deptFilterDropdown.addEventListener('change', (e) => {
            currentDeptFilter = e.target.value;
            applyFilters();
        });
    }

    // Priority filtering via dropdown
    if (priorityFilterDropdown) {
        priorityFilterDropdown.addEventListener('change', (e) => {
            currentPriorityFilter = e.target.value;
            applyFilters();
        });
    }

    // Sorting via dropdown
    if (sortDropdown) {
        sortDropdown.addEventListener('change', async (e) => {
            currentSort = e.target.value;
            // If "Sent by Me" is selected, we need to fetch from sent folder
            // If switching away from "sent", refresh with current folder
            if (currentSort === 'sent') {
                await fetchMemos();
            } else {
                applyFilters();
            }
        });
    }

    // Date filter functionality
    if (dateFilterInput) {
        dateFilterInput.addEventListener('change', (e) => {
            currentDateFilter = e.target.value || null;
            if (currentDateFilter) {
                if (clearDateFilter) {
                    clearDateFilter.style.display = 'inline-flex';
                    // Reinitialize Lucide icons
                    if (typeof lucide !== 'undefined') {
                        // eslint-disable-next-line no-undef
                        lucide.createIcons();
                    }
                }
            } else {
                if (clearDateFilter) {
                    clearDateFilter.style.display = 'none';
                }
            }
            applyFilters();
        });
    }

    // Clear date filter
    if (clearDateFilter) {
        clearDateFilter.addEventListener('click', () => {
            if (dateFilterInput) {
                dateFilterInput.value = '';
                currentDateFilter = null;
                clearDateFilter.style.display = 'none';
                applyFilters();
            }
        });
    }

    // Search functionality
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            fetchMemos();
            showNotification('Refreshing...', 'success');
        });
    }

    // Select dropdown functionality - initialize after a short delay to ensure DOM is ready
    setTimeout(() => {
        const selectBtn = document.getElementById('selectDropdownBtn');
        const selectMenu = document.getElementById('selectDropdownMenu');
        const selectWrapper = document.querySelector('.select-dropdown-wrapper');

        if (selectBtn && selectMenu && selectWrapper) {
            // Toggle dropdown on button click
            selectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                // Position dropdown relative to button
                const rect = selectBtn.getBoundingClientRect();
                selectMenu.style.top = (rect.bottom + 4) + 'px';
                selectMenu.style.left = rect.left + 'px';

                selectWrapper.classList.toggle('open');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (selectWrapper && !selectWrapper.contains(e.target)) {
                    selectWrapper.classList.remove('open');
                }
            });

            // Handle dropdown item clicks
            selectMenu.querySelectorAll('.select-dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const action = item.dataset.action;
                    handleSelectAction(action);
                    if (selectWrapper) {
                        selectWrapper.classList.remove('open');
                    }
                });
            });
        }
    }, 100);

    function handleSelectAction(action) {
        const memoItems = document.querySelectorAll('.memo-item');
        const visibleItems = Array.from(memoItems).filter(item => item.style.display !== 'none');

        switch(action) {
            case 'all':
                // Select all visible memos
                visibleItems.forEach(item => {
                    const checkbox = item.querySelector('.memo-checkbox');
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                    item.classList.add('selected');
                });
                updateSelectionUI();
                break;
            case 'none':
                // Deselect all memos
                memoItems.forEach(item => {
                    const checkbox = item.querySelector('.memo-checkbox');
                    if (checkbox) {
                        checkbox.checked = false;
                    }
                    item.classList.remove('selected');
                });
                updateSelectionUI();
                break;
            case 'read':
                // Filter to show only read memos and select them
                memoItems.forEach(item => {
                    const memoId = item.dataset.id;
                    const memo = filteredMemos.find(m => m._id === memoId);
                    const checkbox = item.querySelector('.memo-checkbox');
                    if (memo && memo.isRead) {
                        item.style.display = '';
                        if (checkbox) {checkbox.checked = true;}
                        item.classList.add('selected');
                    } else {
                        item.style.display = 'none';
                        if (checkbox) {checkbox.checked = false;}
                        item.classList.remove('selected');
                    }
                });
                updateSelectionUI();
                break;
            case 'unread':
                // Filter to show only unread memos and select them
                memoItems.forEach(item => {
                    const memoId = item.dataset.id;
                    const memo = filteredMemos.find(m => m._id === memoId);
                    const checkbox = item.querySelector('.memo-checkbox');
                    if (memo && !memo.isRead) {
                        item.style.display = '';
                        if (checkbox) {checkbox.checked = true;}
                        item.classList.add('selected');
                    } else {
                        item.style.display = 'none';
                        if (checkbox) {checkbox.checked = false;}
                        item.classList.remove('selected');
                    }
                });
                updateSelectionUI();
                break;
            case 'starred':
                // Filter to show only starred memos and select them
                memoItems.forEach(item => {
                    const memoId = item.dataset.id;
                    const memo = filteredMemos.find(m => m._id === memoId);
                    const checkbox = item.querySelector('.memo-checkbox');
                    if (memo && memo.isStarred) {
                        item.style.display = '';
                        if (checkbox) {checkbox.checked = true;}
                        item.classList.add('selected');
                    } else {
                        item.style.display = 'none';
                        if (checkbox) {checkbox.checked = false;}
                        item.classList.remove('selected');
                    }
                });
                updateSelectionUI();
                break;
            case 'unstarred':
                // Filter to show only unstarred memos and select them
                memoItems.forEach(item => {
                    const memoId = item.dataset.id;
                    const memo = filteredMemos.find(m => m._id === memoId);
                    const checkbox = item.querySelector('.memo-checkbox');
                    if (memo && !memo.isStarred) {
                        item.style.display = '';
                        if (checkbox) {checkbox.checked = true;}
                        item.classList.add('selected');
                    } else {
                        item.style.display = 'none';
                        if (checkbox) {checkbox.checked = false;}
                        item.classList.remove('selected');
                    }
                });
                updateSelectionUI();
                break;
        }
    }

    // Update selection UI (archive button visibility, selectDropdown icon state)
    function updateSelectionUI() {
        const checkboxes = document.querySelectorAll('.memo-checkbox');
        const checkedBoxes = Array.from(checkboxes).filter(cb => cb.checked && cb.closest('.memo-item')?.style.display !== 'none');
        const hasSelection = checkedBoxes.length > 0;
        const allVisibleChecked = checkboxes.length > 0 && Array.from(checkboxes).filter(cb => cb.closest('.memo-item')?.style.display !== 'none').every(cb => cb.checked);

        // Update archive button visibility
        const bulkArchiveBtn = document.getElementById('bulkArchiveBtn');
        if (bulkArchiveBtn) {
            bulkArchiveBtn.style.display = hasSelection ? 'inline-flex' : 'none';
        }

        // Update selectDropdown icon state
        if (selectDropdownBtn) {
            const selectIcon = selectDropdownBtn.querySelector('.select-icon');
            if (selectIcon) {
                if (allVisibleChecked && checkboxes.length > 0) {
                    // Show checkmark when all visible are selected
                    selectIcon.setAttribute('data-lucide', 'check-square');
                } else if (hasSelection) {
                    // Show minus-square when some are selected
                    selectIcon.setAttribute('data-lucide', 'minus-square');
                } else {
                    // Show square when none selected
                    selectIcon.setAttribute('data-lucide', 'square');
                }
                // Reinitialize icon
                if (typeof lucide !== 'undefined') {
                    // eslint-disable-next-line no-undef
                    lucide.createIcons();
                }
            }
        }
    }

    // Simple textarea for content - no rich text editor
    const contentTextarea = document.getElementById('content');
    const attachmentsInput = document.getElementById('attachments');
    const attachmentPreview = document.getElementById('attachment-preview');
    const sendMemoBtn = document.getElementById('sendMemoBtn');

    // Store selected files (not uploaded yet - will be sent with form)
    const selectedFiles = [];

    // Registered users for recipient validation (full user data)
    let registeredUsers = [];
    const MAX_VISIBLE_CHIPS = 5; // Show max 5 chips, then "+N more"

    // Load registered users on page load
    async function loadRegisteredUsers() {
        try {
            const res = await fetch('/api/users/emails');
            if (!res.ok) {
                console.error('Failed to load registered users:', res.status, res.statusText);
                return;
            }
            const data = await res.json();
            registeredUsers = Array.isArray(data) ? data : [];
            // Create email lookup map for quick validation
            window.registeredUsersMap = new Map(registeredUsers.map(u => [u.email.toLowerCase(), u]));
            console.log('Loaded registered users for autocomplete:', registeredUsers.length);
        } catch (err) {
            console.error('Error loading registered users:', err);
        }
    }

    // Load users immediately
    loadRegisteredUsers();

    // Recipient chips handling (Gmail-style with collapsible "+N more")
    const recipientsInput = document.getElementById('recipients');
    const recipientChipsContainer = document.getElementById('recipient-chips');
    const recipientData = []; // Store full user data, not just emails

    // Expose recipientData globally for dashboard integration
    window.recipientData = recipientData;

    function renderRecipientChips() {
        if (!recipientChipsContainer) {return;}

        recipientChipsContainer.innerHTML = '';

        const totalRecipients = recipientData.length;
        const visibleCount = Math.min(totalRecipients, MAX_VISIBLE_CHIPS);
        const hiddenCount = totalRecipients - visibleCount;

        // Show visible chips
        for (let i = 0; i < visibleCount; i++) {
            const user = recipientData[i];
            recipientChipsContainer.appendChild(createRecipientChip(user, i));
        }

        // Show "+N more" chip if there are hidden recipients
        if (hiddenCount > 0) {
            const moreChip = document.createElement('span');
            moreChip.className = 'recipient-chip more-chip';
            moreChip.innerHTML = `
                <span class="more-text">+${hiddenCount} more</span>
            `;
            moreChip.addEventListener('click', () => {
                expandRecipientChips();
            });
            recipientChipsContainer.appendChild(moreChip);
        }
    }

    function expandRecipientChips() {
        if (!recipientChipsContainer) {return;}
        recipientChipsContainer.innerHTML = '';
        recipientData.forEach((user, index) => {
            recipientChipsContainer.appendChild(createRecipientChip(user, index));
        });
    }

    // Expose renderRecipientChips globally for dashboard integration
    window.renderRecipientChips = renderRecipientChips;

    function createRecipientChip(user, index) {
        const chip = document.createElement('span');
        chip.className = 'recipient-chip';
        chip.dataset.email = user.email;
        chip.innerHTML = `
            <img src="${user.profilePicture}" alt="${user.fullName}" class="chip-avatar" onerror="this.src='/images/memofy-logo.png'">
            <span class="chip-name">${user.fullName || user.email}</span>
            <button type="button" class="chip-remove" aria-label="Remove ${user.email}">×</button>
        `;

        const removeBtn = chip.querySelector('.chip-remove');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const email = user.email.toLowerCase();
            const dataIndex = recipientData.findIndex(u => u.email.toLowerCase() === email);
            if (dataIndex > -1) {
                recipientData.splice(dataIndex, 1);
            }
            renderRecipientChips();
        });

        return chip;
    }

    // Simple typeahead for recipients
    let recipientSuggestEl = null;
    let recipientSuggestItems = [];
    let recipientSuggestIndex = -1;

    function ensureRecipientSuggest(){
        if (recipientSuggestEl) {return recipientSuggestEl;}
        const wrapper = recipientsInput && recipientsInput.parentElement;
        if (!wrapper) {
            console.error('Recipient input wrapper not found');
            return null;
        }
        // Ensure wrapper allows overflow for dropdown
        if (wrapper.style) {
            wrapper.style.overflow = 'visible';
            wrapper.style.position = 'relative';
        }
        const ul = document.createElement('ul');
        ul.id = 'recipientSuggestions';
        ul.style.position = 'absolute';
        ul.style.left = '0';
        ul.style.right = '0';
        ul.style.top = '100%';
        ul.style.marginTop = '4px';
        ul.style.padding = '4px 0';
        ul.style.listStyle = 'none';
        ul.style.background = '#fff';
        ul.style.border = '1px solid #e2e8f0';
        ul.style.borderRadius = '8px';
        ul.style.boxShadow = '0 10px 20px rgba(2,6,23,.1)';
        ul.style.maxHeight = '260px';
        ul.style.overflowY = 'auto';
        ul.style.zIndex = '10010';
        ul.style.display = 'none';
        wrapper.appendChild(ul);
        recipientSuggestEl = ul;
        return ul;
    }

    function closeRecipientSuggest(){
        if (recipientSuggestEl) { recipientSuggestEl.style.display = 'none'; }
        recipientSuggestItems = [];
        recipientSuggestIndex = -1;
    }

    function openRecipientSuggest(items){
        const ul = ensureRecipientSuggest();
        if (!ul) {
            console.error('Could not create recipient suggestions dropdown');
            return;
        }
        if (!items || items.length === 0) {
            ul.style.display = 'none';
            return;
        }
        recipientSuggestItems = items;
        recipientSuggestIndex = -1;
        ul.innerHTML = items.map((u, i) => `
            <li data-i="${i}" style="padding:8px 12px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background-color 0.15s;">
                <img src="${u.profilePicture || '/images/memofy-logo.png'}" onerror="this.src='/images/memofy-logo.png'" style="width:24px;height:24px;border-radius:50%;object-fit:cover;"/>
                <div style="display:flex;flex-direction:column;">
                    <span style="font-size:13px;color:#0f172a;font-weight:600;">${(u.firstName||'') + ' ' + (u.lastName||'')}</span>
                    <span style="font-size:12px;color:#64748b;">${u.email}</span>
                </div>
            </li>
        `).join('');
        ul.style.display = 'block';
        // mouse selection
        ul.querySelectorAll('li').forEach(li => {
            li.addEventListener('mouseenter', () => {
                const i = Number(li.dataset.i);
                highlightRecipientSuggest(i);
            });
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const i = Number(li.dataset.i);
                chooseRecipientSuggest(i);
            });
        });
    }

    function highlightRecipientSuggest(i){
        const ul = recipientSuggestEl; if (!ul) {return;}
        recipientSuggestIndex = i;
        Array.from(ul.children).forEach((li, idx) => {
            li.style.background = (idx === i) ? '#eef2ff' : 'transparent';
        });
    }

    function chooseRecipientSuggest(i){
        const user = recipientSuggestItems[i];
        if (!user) {return;}
        // avoid duplicates
        if (!recipientData.find(u => String(u.email).toLowerCase() === String(user.email).toLowerCase())) {
            recipientData.push(user);
            renderRecipientChips();
        }
        if (recipientsInput) { recipientsInput.value = ''; }
        closeRecipientSuggest();
    }

    if (recipientsInput && recipientChipsContainer) {
        const isSecretary = window.currentUser && window.currentUser.role === 'secretary';
        const myDept = (isSecretary && window.currentUser && window.currentUser.department)
            ? String(window.currentUser.department).toLowerCase()
            : '';

        recipientsInput.addEventListener('input', (e) => {
            const q = (recipientsInput.value || '').trim().toLowerCase();
            if (!q) { closeRecipientSuggest(); return; }

            // If registeredUsers is empty, try to reload
            if (!registeredUsers || registeredUsers.length === 0) {
                console.warn('Registered users not loaded yet, attempting to reload...');
                loadRegisteredUsers().then(() => {
                    // Retry the search after loading
                    const retryQ = (recipientsInput.value || '').trim().toLowerCase();
                    if (retryQ) {
                        recipientsInput.dispatchEvent(new Event('input'));
                    }
                });
                return;
            }

            const picked = new Set(recipientData.map(u => String(u.email).toLowerCase()));
            const isAdmin = window.currentUser?.role === 'admin';

            const results = (registeredUsers || []).filter(u => {
                const email = String(u.email || '').toLowerCase();
                if (!email || picked.has(email)) { return false; }

                const role = String(u.role || '').toLowerCase();
                // Admins can send to other users, but not to other admins (unless it's themselves)
                if (role === 'admin' && !isAdmin) { return false; }
                // For admins, allow sending to secretaries and faculty
                if (isAdmin && role === 'admin') {
                    // Allow admins to send to other admins if needed
                    // But typically admins send to secretaries/faculty
                }

                const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
                const matchesQuery = name.includes(q) || email.includes(q);
                if (!matchesQuery) { return false; }

                if (isSecretary && myDept) {
                    const userDept = String(u.department || '').toLowerCase();
                    if (userDept !== myDept) { return false; }
                    // Secretaries primarily send to faculty within their department
                    if (role && role !== 'faculty') { return false; }
                }

                return true;
            }).slice(0, 8);

            if (results.length) {
                openRecipientSuggest(results);
            } else {
                closeRecipientSuggest();
            }
        });

        recipientsInput.addEventListener('keydown', (e) => {
            if (recipientSuggestItems.length) {
                if (e.key === 'ArrowDown') { e.preventDefault(); highlightRecipientSuggest(Math.min(recipientSuggestItems.length-1, recipientSuggestIndex+1)); return; }
                if (e.key === 'ArrowUp')   { e.preventDefault(); highlightRecipientSuggest(Math.max(0, recipientSuggestIndex-1)); return; }
                if (e.key === 'Enter' && recipientSuggestIndex >= 0) { e.preventDefault(); chooseRecipientSuggest(recipientSuggestIndex); return; }
                if (e.key === 'Escape') { closeRecipientSuggest(); return; }
            }
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const email = recipientsInput.value.trim().toLowerCase();

                if (!email) {return;}

                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    showErrorModal('Please enter a valid email address.');
                    return;
                }

                // Validate email domain - only allow BukSU domains
                const allowedDomains = ['@buksu.edu.ph', '@student.buksu.edu.ph'];
                const isValidDomain = allowedDomains.some(domain => email.endsWith(domain));
                if (!isValidDomain) {
                    showRecipientDomainError('Only @buksu.edu.ph or @student.buksu.edu.ph email addresses are allowed.');
                    return;
                }

                // Validate against registered users
                const user = window.registeredUsersMap?.get(email);
                if (!user) {
                    showErrorModal(`Email "${email}" is not registered.`);
                    return;
                }

                const role = String(user.role || '').toLowerCase();
                if (role === 'admin') {
                    showNotification('Admins cannot be selected as memo recipients.', 'error');
                    return;
                }

                if (window.currentUser && window.currentUser.role === 'secretary') {
                    const myDept = window.currentUser.department ? String(window.currentUser.department).toLowerCase() : '';
                    const userDept = String(user.department || '').toLowerCase();
                    if (myDept && userDept !== myDept) {
                        showNotification('Secretaries may only send memos to recipients within their department.', 'error');
                        return;
                    }
                    if (role !== 'faculty') {
                        showNotification('Secretaries may only send memos to faculty members.', 'error');
                        return;
                    }
                }

                // Check if already added
                if (recipientData.find(u => u.email.toLowerCase() === email)) {
                    showNotification(`Email "${email}" is already added.`, 'error');
                    recipientsInput.value = '';
                    return;
                }

                // Add to recipient list
                recipientData.push(user);
                recipientsInput.value = '';
                renderRecipientChips();
                closeRecipientSuggest();
            }
        });

        recipientsInput.addEventListener('blur', () => {
            setTimeout(closeRecipientSuggest, 100);
        });

        // Handle paste events for comma-separated emails
        recipientsInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                const pastedText = recipientsInput.value.trim();
                const emails = pastedText.split(/[\,\s]+/).filter(e => e.trim());

                if (emails.length > 1) {
                    recipientsInput.value = '';
                    emails.forEach(email => {
                        const lookupEmail = email.toLowerCase();
                        const user = window.registeredUsersMap?.get(lookupEmail);
                        if (!user) { return; }

                        const role = String(user.role || '').toLowerCase();
                        if (role === 'admin') { return; }

                        if (window.currentUser && window.currentUser.role === 'secretary') {
                            const myDept = window.currentUser.department ? String(window.currentUser.department).toLowerCase() : '';
                            const userDept = String(user.department || '').toLowerCase();
                            if (myDept && userDept !== myDept) { return; }
                            if (role !== 'faculty') { return; }
                        }

                        if (!recipientData.find(u => u.email.toLowerCase() === lookupEmail)) {
                            recipientData.push(user);
                        }
                    });
                    renderRecipientChips();
                    closeRecipientSuggest();
                }
            }, 0);
        });
    }

    // Handle file addition (used by both click and drag-drop)
    function handleFiles(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) {return;}

        fileArray.forEach(file => {
            // Validate file size
            if (file.size > 10 * 1024 * 1024) {
                showNotification(`File "${file.name}" exceeds 10MB limit`, 'error');
                return;
            }

            // Check if already added
            if (selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                showNotification(`File "${file.name}" is already added.`, 'error');
                return;
            }

            // Add to selected files
            selectedFiles.push(file);
            addAttachmentPreview(file);
        });

        updateAttachmentPreviewVisibility();
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) {return bytes + ' B';}
        if (bytes < 1024 * 1024) {return (bytes / 1024).toFixed(1) + ' KB';}
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function addAttachmentPreview(file) {
        if (!attachmentPreview) {return;}

        const chip = document.createElement('div');
        chip.className = 'attachment-preview-chip';
        chip.dataset.filename = file.name;

        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf';
        const iconHtml = isImage
            ? `<i data-lucide="image" style="width: 16px; height: 16px;"></i>`
            : isPDF
            ? `<i data-lucide="file-text" style="width: 16px; height: 16px;"></i>`
            : `<i data-lucide="file" style="width: 16px; height: 16px;"></i>`;

        // Create preview URL for images/PDFs
        const previewUrl = (isImage || isPDF) ? URL.createObjectURL(file) : null;

        chip.innerHTML = `
            ${iconHtml}
            <span class="attachment-name" ${previewUrl ? `onclick="window.open('${previewUrl}', '_blank')"` : ''}>${file.name}</span>
            <span class="attachment-size">${formatFileSize(file.size)}</span>
            <button type="button" class="attachment-remove" aria-label="Remove ${file.name}">×</button>
        `;

        // Make filename clickable if it's a previewable file
        if (previewUrl) {
            const nameSpan = chip.querySelector('.attachment-name');
            nameSpan.style.cursor = 'pointer';
            nameSpan.style.textDecoration = 'underline';
            nameSpan.title = 'Click to preview';
        }

        const removeBtn = chip.querySelector('.attachment-remove');
        removeBtn.addEventListener('click', () => {
            const index = selectedFiles.findIndex(f => f === file);
            if (index > -1) {
                selectedFiles.splice(index, 1);
            }
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            chip.remove();
            updateAttachmentPreviewVisibility();
            lucide.createIcons();
        });

        attachmentPreview.appendChild(chip);
        updateAttachmentPreviewVisibility();
        lucide.createIcons();
    }

    // Attachment handling - single attach button for all files/images
    // Function to setup attachment handlers
    function setupAttachmentHandlers() {
        const composeModal = document.getElementById('composeModal');
        if (!composeModal) {return;}

        const attachmentsInput = composeModal.querySelector('#attachments');
        const attachmentPreview = composeModal.querySelector('#attachment-preview');
        const attachBtn = composeModal.querySelector('#attachBtn');

        if (!attachmentsInput || !attachmentPreview || !attachBtn) {
            // eslint-disable-next-line no-console
            console.log('Attachment elements not found:', {attachmentsInput, attachmentPreview, attachBtn});
            return;
        }

        // Remove existing listeners by cloning
        const newAttachBtn = attachBtn.cloneNode(true);
        attachBtn.parentNode.replaceChild(newAttachBtn, attachBtn);
        const freshAttachBtn = composeModal.querySelector('#attachBtn');

        // Setup file input change handler - remove old and add new
        const newInput = attachmentsInput.cloneNode();
        attachmentsInput.parentNode.replaceChild(newInput, attachmentsInput);
        const freshInput = composeModal.querySelector('#attachments');

        freshInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
                e.target.value = ''; // Reset to allow selecting same file again
            }
        });

        // Ensure attach button click triggers file input
        freshAttachBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = composeModal.querySelector('#attachments');
            if (input) {
                // Force click on the hidden file input
                input.focus();
                input.click();
            } else {
                // eslint-disable-next-line no-console
                console.error('File input not found');
            }
        }, false);

        // Also handle clicks on the icon itself
        const icon = freshAttachBtn.querySelector('i[data-lucide="paperclip"]');
        if (icon) {
            icon.style.pointerEvents = 'none'; // Let clicks pass through to button
        }

        // Reinitialize Lucide icons for the button
        if (typeof lucide !== 'undefined') {
            // eslint-disable-next-line no-undef
            lucide.createIcons();
        }
    }

    // Initialize attachment handlers on page load
    setupAttachmentHandlers();

    // Drag-and-drop support - append files, don't replace
    const composeContentArea = document.getElementById('composeContentArea');
    if (composeContentArea) {
        let dragCounter = 0;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            composeContentArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        composeContentArea.addEventListener('dragenter', (e) => {
            dragCounter++;
            composeContentArea.classList.add('drag-over');
        });

        composeContentArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            composeContentArea.classList.add('drag-over');
        });

        composeContentArea.addEventListener('dragleave', (e) => {
            dragCounter--;
            if (dragCounter === 0) {
                composeContentArea.classList.remove('drag-over');
            }
        });

        composeContentArea.addEventListener('drop', (e) => {
            dragCounter = 0;
            composeContentArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                // Append files to existing list (don't replace)
                handleFiles(files);
            }
        });
    }

    function updateAttachmentPreviewVisibility() {
        if (!attachmentPreview) {return;}
        if (selectedFiles.length === 0) {
            attachmentPreview.style.display = 'none';
        } else {
            attachmentPreview.style.display = 'flex';
        }
    }


    // Compose form - scoped to compose modal only
    if (composeForm) {
        composeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Scope all queries to compose modal only
            const composeModal = document.getElementById('composeModal');
            if (!composeModal) {return;}

            // Validation - get recipient emails from chips
            let selectedDepartments = Array.from(composeModal.querySelectorAll('.dept-option:checked'))
                .map(cb => cb.value);

            // Handle "Select All" for admins
            const selectAll = composeModal.querySelector('#selectAllDepts');
            if (selectAll && selectAll.checked) {
                selectedDepartments = [];
                composeModal.querySelectorAll('.dept-option').forEach(cb => {
                    if (cb.value) {
                        selectedDepartments.push(cb.value);
                    }
                });
            }

            // Handle secretary department checkbox
            const isSecretary = window.currentUser && window.currentUser.role === 'secretary';
            const sendToAllDeptCheckbox = composeModal.querySelector('#sendToAllDeptCheckbox');
            if (isSecretary && sendToAllDeptCheckbox) {
                const secretaryDept = window.currentUser.department;
                if (sendToAllDeptCheckbox.checked) {
                    // If checked, add secretary's department to selectedDepartments
                    if (secretaryDept && !selectedDepartments.includes(secretaryDept)) {
                        selectedDepartments.push(secretaryDept);
                    }
                } else {
                    // If unchecked, remove secretary's department from selectedDepartments
                    selectedDepartments = selectedDepartments.filter(d => d !== secretaryDept);
                }
            }

            // Validate at least one recipient or department
            // For secretaries, allow submission without departments (only if they have individual recipients)
            if (recipientData.length === 0 && selectedDepartments.length === 0 && !isSecretary) {
                showNotification('Please specify at least one recipient or department.', 'error');
                return;
            }

            // For secretaries, require at least one recipient OR department checkbox
            if (isSecretary && recipientData.length === 0 && selectedDepartments.length === 0) {
                showNotification('Please select at least one recipient or enable "Send to all department members".', 'error');
                return;
            }

            // Validate subject and content
            const subject = document.getElementById('subject').value.trim();
            if (!subject) {
                showNotification('Subject is required', 'error');
                return;
            }

            // Get content from textarea (optional)
            const content = contentTextarea ? contentTextarea.value.trim() : '';

            // Create FormData
            const formData = new FormData();

            // Add recipient emails (comma-separated if multiple)
            if (recipientData.length > 0) {
                const emails = recipientData.map(u => u.email).join(',');
                formData.append('recipientEmail', emails);
            }

            formData.append('subject', subject);
            formData.append('content', content);

            // Multiple departments - send as array
            if (selectedDepartments.length > 0) {
                selectedDepartments.forEach(dept => {
                    formData.append('departments', dept);
                });
            }

            // Get priority from select dropdown
            const prioritySelect = composeModal.querySelector('#prioritySelect');
            const priority = prioritySelect ? prioritySelect.value : 'medium';
            formData.append('priority', priority);

            // Template (selected signature IDs) and signatures (if any)
            const selectedCheckboxes = composeModal.querySelectorAll('.template-checkbox:checked');
            const selectedSignatureIds = Array.from(selectedCheckboxes).map(cb => cb.value).filter(id => id !== 'none');
            formData.append('template', selectedSignatureIds.length > 0 ? selectedSignatureIds.join(',') : 'none');
            const signatoryInputs = composeModal.querySelectorAll('.signatory-meta');
            signatoryInputs.forEach(input => {
                const role = input.getAttribute('data-role') || '';
                const sigId = input.getAttribute('data-signature-id') || '';
                if (role && sigId) {
                    formData.append('signatories', JSON.stringify({ role: role, signatureId: sigId }));
                }
            });

            // Add files directly (not pre-uploaded URLs)
            selectedFiles.forEach(file => {
                formData.append('attachments', file);
            });

            // Add optional date and time for calendar event and scheduled sending
            const memoDate = composeModal.querySelector('#memoDate');
            const memoTime = composeModal.querySelector('#memoTime');
            const allDayEvent = composeModal.querySelector('#allDayEvent');
            const memoEndDate = composeModal.querySelector('#memoEndDate');
            const memoEndTime = composeModal.querySelector('#memoEndTime');

            if (memoDate && memoDate.value) {
                formData.append('eventDate', memoDate.value);

                // Add End date/time if provided
                if (memoEndDate && memoEndDate.value) {
                    formData.append('eventEndDate', memoEndDate.value);
                }
                if (memoEndTime && memoEndTime.value) {
                    formData.append('eventEndTime', memoEndTime.value);
                }

                // Calculate scheduledSendAt (when memo should be sent)
                let scheduledSendAt;
                if (allDayEvent && allDayEvent.value === 'true') {
                    formData.append('allDay', 'true');
                    // For all-day events, send at start of day
                    scheduledSendAt = new Date(memoDate.value + 'T00:00:00');
                } else if (memoTime && memoTime.value) {
                    formData.append('eventTime', memoTime.value);
                    formData.append('allDay', 'false');
                    // For timed events, send at the specified time
                    scheduledSendAt = new Date(memoDate.value + 'T' + memoTime.value + ':00');
                } else {
                    formData.append('allDay', 'true'); // Default to all day if date but no time
                    scheduledSendAt = new Date(memoDate.value + 'T00:00:00');
                }

                // Only schedule if the date/time is in the future
                if (scheduledSendAt && scheduledSendAt > new Date()) {
                    formData.append('scheduledSendAt', scheduledSendAt.toISOString());
                }
            }

            // Show loading state
            const sendBtn = document.getElementById('sendMemoBtn');
            const btnText = sendBtn ? sendBtn.querySelector('.btn-text') : null;
            const btnLoading = sendBtn ? sendBtn.querySelector('.btn-loading') : null;
            const sendingModal = document.getElementById('sendingModal');

            if (sendBtn) {
                sendBtn.disabled = true;
                if (btnText) {btnText.style.display = 'none';}
                if (btnLoading) {btnLoading.style.display = 'inline-flex';}
            }

            if (sendingModal) {
                sendingModal.style.display = 'flex';
            }

            try {
                const response = await fetch('/api/log/memos', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Server error: ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    // Show success state in sending modal (spinner -> check + message)
                    if (sendingModal) {
                        sendingModal.style.display = 'flex';
                        const contentEl = sendingModal.querySelector('.sending-modal-content');
                        if (contentEl) {
                            contentEl.innerHTML = `
                                <div style="width:52px;height:52px;border-radius:50%;background:#10b981;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;color:#fff;font-size:28px;">✓</div>
                                <p style="margin:0; color:#111827; font-weight:600; text-align:center;">
                                    ${ (window.currentUser && window.currentUser.role === 'secretary')
                                        ? 'Your memo is pending admin approval.'
                                        : (data.message || 'Memo sent successfully.') }
                                </p>`;
                        }
                    }

                    // Reset form
                    composeForm.reset();
                    if (contentTextarea) {
                        contentTextarea.value = '';
                    }

                    // Clear recipient chips
                    recipientData.length = 0;
                    if (recipientChipsContainer) {
                        recipientChipsContainer.innerHTML = '';
                    }
                    if (recipientsInput) {
                        recipientsInput.value = '';
                    }

                    // Clear attachments
                    selectedFiles.length = 0;
                    if (attachmentPreview) {
                        attachmentPreview.innerHTML = '';
                        attachmentPreview.style.display = 'none';
                    }
                    if (attachmentsInput) {
                        attachmentsInput.value = '';
                    }

                    // Reset department selections - scoped to compose modal only
                    const composeModal = document.getElementById('composeModal');
                    if (composeModal) {
                        composeModal.querySelectorAll('.dept-option').forEach(cb => {
                            cb.checked = false;
                        });
                        const selectAll = composeModal.querySelector('#selectAllDepts');
                        if (selectAll) {selectAll.checked = false;}
                        const dropdownBtn = composeModal.querySelector('#deptDropdownBtn');
                        if (dropdownBtn) {
                            const placeholder = dropdownBtn.querySelector('.dept-placeholder');
                            if (placeholder) {
                                placeholder.textContent = 'Department';
                            } else {
                                dropdownBtn.textContent = 'Department';
                            }
                        }
                        // Close dropdown if open
                        const dropdown = composeModal.querySelector('.custom-dropdown');
                        if (dropdown) {
                            dropdown.classList.remove('open');
                        }

                        // Reset date/time fields
                        clearSchedule();
                    }

                    // Reset button state
                    if (sendBtn) {
                        sendBtn.disabled = false;
                        if (btnText) {btnText.style.display = 'inline';}
                        if (btnLoading) {btnLoading.style.display = 'none';}
                    }

                    // Close success modal + compose after a short delay
                    setTimeout(() => {
                        if (sendingModal) {sendingModal.style.display = 'none';}
                        closeModal(composeModal);
                        fetchMemos();
                    }, 1200);
                } else {
                    // Hide sending modal
                    if (sendingModal) {
                        sendingModal.style.display = 'none';
                    }

                    showNotification(data.message || 'Error sending memo', 'error');
                    if (sendBtn) {
                        sendBtn.disabled = false;
                        if (btnText) {btnText.style.display = 'inline';}
                        if (btnLoading) {btnLoading.style.display = 'none';}
                    }
                }
            } catch (error) {
                // Hide sending modal
                if (sendingModal) {
                    sendingModal.style.display = 'none';
                }

                // eslint-disable-next-line no-console
                console.error('Error:', error);
                showNotification(`Error sending memo: ${error.message}`, 'error');
                if (sendBtn) {
                    sendBtn.disabled = false;
                    if (btnText) {btnText.style.display = 'inline';}
                    if (btnLoading) {btnLoading.style.display = 'none';}
                }
            }
        });
    }

    // Load departments dynamically from server (combines IT/EMC)
    // Scoped to compose modal only
    async function loadDepartments(){
        try{
            const composeModal = document.getElementById('composeModal');
            if (!composeModal) {
                // eslint-disable-next-line no-console
                console.warn('loadDepartments: composeModal not found');
                return;
            }

            // eslint-disable-next-line no-console
            console.log('loadDepartments: Fetching departments...');
            const res = await fetch('/api/users/departments');
            if (!res.ok) {
                throw new Error(`Failed to fetch departments: ${res.status} ${res.statusText}`);
            }
            const data = await res.json();
            // eslint-disable-next-line no-console
            console.log('loadDepartments: Received data:', data);

            // Scope to compose modal only
            // Check both admin and secretary dropdown locations
            const userRole = window.currentUser?.role || 'faculty';
            const canCrossSend = window.currentUser?.canCrossSend || false;
            // eslint-disable-next-line no-console
            console.log('loadDepartments: User role:', userRole, 'canCrossSend:', canCrossSend);

            // For secretaries with canCrossSend, look in secretary wrapper first
            let container, dropdownBtn, dropdownMenu;
            if (userRole === 'secretary' && canCrossSend) {
                const secretaryWrapper = composeModal.querySelector('#secretaryDeptDropdownWrapper');
                // eslint-disable-next-line no-console
                console.log('loadDepartments: Secretary wrapper found:', !!secretaryWrapper);
                if (secretaryWrapper) {
                    // Check if wrapper is visible
                    const wrapperStyle = window.getComputedStyle(secretaryWrapper);
                    // eslint-disable-next-line no-console
                    console.log('loadDepartments: Wrapper display:', wrapperStyle.display);

                    container = secretaryWrapper.querySelector('#deptCheckboxesContainer');
                    dropdownBtn = secretaryWrapper.querySelector('#deptDropdownBtn');
                    dropdownMenu = secretaryWrapper.querySelector('#deptDropdownMenu');
                    // eslint-disable-next-line no-console
                    console.log('loadDepartments: Elements in wrapper:', {
                        container: !!container,
                        dropdownBtn: !!dropdownBtn,
                        dropdownMenu: !!dropdownMenu,
                        containerId: container ? container.id : 'none',
                        dropdownBtnId: dropdownBtn ? dropdownBtn.id : 'none',
                        dropdownMenuId: dropdownMenu ? dropdownMenu.id : 'none'
                    });
                } else {
                    // eslint-disable-next-line no-console
                    console.warn('loadDepartments: Secretary wrapper not found even though canCrossSend is true');
                }
            }

            // Fallback to admin location if not found
            if (!container) {
                container = composeModal.querySelector('#deptCheckboxesContainer');
            }
            if (!dropdownBtn) {
                dropdownBtn = composeModal.querySelector('#deptDropdownBtn');
            }
            if (!dropdownMenu) {
                dropdownMenu = composeModal.querySelector('#deptDropdownMenu');
            }

            if (!container || !dropdownBtn || !dropdownMenu) {
                // eslint-disable-next-line no-console
                console.error('Department dropdown elements not found:', {
                    container: !!container,
                    dropdownBtn: !!dropdownBtn,
                    dropdownMenu: !!dropdownMenu,
                    userRole,
                    canCrossSend
                });
                return;
            }

            const userDepartment = window.currentUser?.department || '';

            container.innerHTML = '';
            const departments = data.departments || [];
            // eslint-disable-next-line no-console
            console.log('loadDepartments: Departments from API:', departments);

            // Filter departments based on role - for canCrossSend secretaries, show all departments
            let availableDepartments = departments;
            if (userRole === 'secretary' && !canCrossSend) {
                availableDepartments = departments.filter(d => d === userDepartment);
            }
            // eslint-disable-next-line no-console
            console.log('loadDepartments: Available departments:', availableDepartments);

            // Show "Select All" for admins and canCrossSend secretaries
            const selectAllCheckbox = composeModal.querySelector('#selectAllDepts');
            const selectAllLabel = composeModal.querySelector('#selectAllDeptsLabel');
            if (selectAllCheckbox && selectAllLabel) {
                if (userRole === 'admin' || (userRole === 'secretary' && canCrossSend)) {
                    selectAllLabel.style.display = 'block';
                    const hr = dropdownMenu.querySelector('.dept-dropdown-hr');
                    if (hr) {hr.style.display = 'block';}
                } else {
                    selectAllLabel.style.display = 'none';
                    const hr = dropdownMenu.querySelector('.dept-dropdown-hr');
                    if (hr) {hr.style.display = 'none';}
                }
            }

            // Add department checkboxes
            if (availableDepartments.length === 0) {
                // eslint-disable-next-line no-console
                console.warn('loadDepartments: No departments available to display');
            } else {
                availableDepartments.forEach(dept => {
                    const label = document.createElement('label');
                    label.className = 'dept-checkbox-label';
                    label.innerHTML = `
                        <input type="checkbox" class="dept-checkbox dept-option" value="${dept}">
                        <span>${dept}</span>
                    `;
                    container.appendChild(label);
                });
                // eslint-disable-next-line no-console
                console.log('loadDepartments: Added', availableDepartments.length, 'department checkboxes');
            }

            // Update label
            if (userRole === 'admin' || (userRole === 'secretary' && canCrossSend)) {
                const multiLabel = document.getElementById('multiSelectLabel');
                if (multiLabel) { multiLabel.style.display = 'inline'; }
            }

            // Initialize dropdown functionality (pass composeModal for scoping)
            // Wait a bit to ensure DOM is ready
            setTimeout(() => {
                initCustomDepartmentDropdown(composeModal);
            }, 100);
        }catch(e){
            // eslint-disable-next-line no-console
            console.error('Error loading departments:', e);
        }
    }

    // Initialize custom department dropdown
    // Scoped to compose modal only to avoid conflicts with other dropdowns
    function initCustomDepartmentDropdown(composeModal) {
        if (!composeModal) {
            composeModal = document.getElementById('composeModal');
            if (!composeModal) {return;}
        }

        // Check both admin location and secretary wrapper location
        let dropdownBtn = composeModal.querySelector('#deptDropdownBtn');
        let dropdownMenu = composeModal.querySelector('#deptDropdownMenu');

        // For secretaries with canCrossSend, check secretary wrapper first
        if (!dropdownBtn || !dropdownMenu) {
            const secretaryWrapper = composeModal.querySelector('#secretaryDeptDropdownWrapper');
            if (secretaryWrapper) {
                dropdownBtn = secretaryWrapper.querySelector('#deptDropdownBtn');
                dropdownMenu = secretaryWrapper.querySelector('#deptDropdownMenu');
            }
        }

        // Check both locations for selectAll checkbox
        let selectAll = composeModal.querySelector('#selectAllDepts');
        if (!selectAll) {
            const secretaryWrapper = composeModal.querySelector('#secretaryDeptDropdownWrapper');
            if (secretaryWrapper) {
                selectAll = secretaryWrapper.querySelector('#selectAllDepts');
            }
        }

        let deptOptions = composeModal.querySelectorAll('.dept-option');

        if (!dropdownBtn || !dropdownMenu) {
            return;
        }

        // Remove any existing click handlers to prevent duplicates
        const newBtn = dropdownBtn.cloneNode(true);
        dropdownBtn.parentNode.replaceChild(newBtn, dropdownBtn);

        // Get the fresh button - check both locations again after cloning
        let freshBtn = composeModal.querySelector('#deptDropdownBtn');
        if (!freshBtn) {
            const secretaryWrapper = composeModal.querySelector('#secretaryDeptDropdownWrapper');
            if (secretaryWrapper) {
                freshBtn = secretaryWrapper.querySelector('#deptDropdownBtn');
            }
        }

        if (!freshBtn) {
            console.error('initCustomDepartmentDropdown: Could not find deptDropdownBtn after cloning');
            return;
        }

        // Get the fresh dropdown menu - check both locations again after cloning
        let freshDropdownMenu = composeModal.querySelector('#deptDropdownMenu');
        if (!freshDropdownMenu) {
            const secretaryWrapper = composeModal.querySelector('#secretaryDeptDropdownWrapper');
            if (secretaryWrapper) {
                freshDropdownMenu = secretaryWrapper.querySelector('#deptDropdownMenu');
            }
        }

        if (!freshDropdownMenu) {
            console.error('initCustomDepartmentDropdown: Could not find deptDropdownMenu after cloning');
            return;
        }

        const deptDropdown = freshBtn.closest('.custom-dropdown');

        // Toggle dropdown on button click
        freshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Close template dropdown if open
            const templateBtn = composeModal.querySelector('#templateDropdownBtn');
            const templateDropdown = templateBtn ? templateBtn.closest('.custom-dropdown') : null;
            if (templateDropdown && templateDropdown.classList.contains('open')) {
                templateDropdown.classList.remove('open');
                // Also hide the template menu explicitly
                const templateMenu = templateDropdown.querySelector('#templateDropdownMenu');
                if (templateMenu) {
                    templateMenu.style.display = 'none';
                    templateMenu.style.visibility = 'hidden';
                    templateMenu.style.opacity = '0';
                }
            }
            // Close other open dropdowns inside compose modal (e.g., template)
            composeModal.querySelectorAll('.custom-dropdown.open').forEach(dd => {
                if (dd !== deptDropdown) {
                    dd.classList.remove('open');
                    // Also hide their menus
                    const menu = dd.querySelector('.dept-dropdown-menu');
                    if (menu) {
                        menu.style.display = 'none';
                        menu.style.visibility = 'hidden';
                        menu.style.opacity = '0';
                    }
                }
            });
            if (deptDropdown) {
                const isOpen = deptDropdown.classList.contains('open');
                deptDropdown.classList.toggle('open');
                const isOpenAfter = deptDropdown.classList.contains('open');

                // Force display if open class is added (fallback if CSS doesn't apply)
                if (isOpenAfter && freshDropdownMenu) {
                    freshDropdownMenu.style.display = 'block';
                    freshDropdownMenu.style.visibility = 'visible';
                    freshDropdownMenu.style.opacity = '1';
                    freshDropdownMenu.style.zIndex = '100002';
                    freshDropdownMenu.style.position = 'absolute';
                    freshDropdownMenu.style.top = '100%';
                    freshDropdownMenu.style.left = '0';
                    freshDropdownMenu.style.right = '0';
                    freshDropdownMenu.style.marginTop = '4px';
                } else if (!isOpenAfter && freshDropdownMenu) {
                    freshDropdownMenu.style.display = 'none';
                }
            }
        });

        // Ensure clicks on placeholder don't interfere
        const placeholder = freshBtn.querySelector('.dept-placeholder');
        if (placeholder) {
            placeholder.style.pointerEvents = 'none';
        }

        // Close this dropdown when clicking outside
        const handleOutsideClick = (e) => {
            // Don't close if clicking on template dropdown elements
            const templateDropdown = composeModal.querySelector('#templateDropdownBtn')?.closest('.custom-dropdown');
            const isClickOnTemplate = templateDropdown && (
                templateDropdown.contains(e.target) ||
                e.target.closest('#templateDropdownBtn') ||
                e.target.closest('#templateDropdownMenu')
            );

            // Don't close if clicking on department dropdown button or menu
            const isClickOnDept = deptDropdown && (
                deptDropdown.contains(e.target) ||
                freshBtn.contains(e.target) ||
                freshDropdownMenu.contains(e.target) ||
                e.target.closest('#deptDropdownBtn') ||
                e.target.closest('#deptDropdownMenu')
            );

            // Only close if clicking outside BOTH dropdowns and dropdown is actually open
            if (deptDropdown && deptDropdown.classList.contains('open') && !isClickOnDept && !isClickOnTemplate) {
                deptDropdown.classList.remove('open');
                // Also hide the menu explicitly
                if (freshDropdownMenu) {
                    freshDropdownMenu.style.display = 'none';
                    freshDropdownMenu.style.visibility = 'hidden';
                    freshDropdownMenu.style.opacity = '0';
                }
            }
        };
        document.addEventListener('click', handleOutsideClick, true);
        deptDropdown._outsideClickHandler = handleOutsideClick;

        // Select All functionality
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                deptOptions = composeModal.querySelectorAll('.dept-option');
                deptOptions.forEach(cb => { cb.checked = selectAll.checked; });
                updateDeptButtonLabel();
            });
        }

        function attachCheckboxListeners() {
            deptOptions = composeModal.querySelectorAll('.dept-option');
            deptOptions.forEach(cb => {
                cb.addEventListener('change', () => {
                    if (selectAll && !cb.checked) { selectAll.checked = false; }
                    if (selectAll) {
                        const allChecked = Array.from(deptOptions).every(opt => opt.checked);
                        selectAll.checked = allChecked;
                    }
                    updateDeptButtonLabel();
                });
            });
        }

        attachCheckboxListeners();

        function updateDeptButtonLabel() {
            deptOptions = composeModal.querySelectorAll('.dept-option');
            const selected = Array.from(composeModal.querySelectorAll('.dept-option:checked')).map(cb => cb.value);
            const total = deptOptions.length;
            const ph = freshBtn.querySelector('.dept-placeholder');

            if (selected.length === 0) {
                if (ph) { ph.textContent = 'Department'; } else { freshBtn.textContent = 'Department'; }
                freshBtn.classList.add('empty');
            } else {
                freshBtn.classList.remove('empty');
                if (ph) {
                    if (selected.length === total && selectAll) { ph.textContent = 'All Departments'; }
                    else if (selected.length === 1) { ph.textContent = selected[0]; }
                    else { ph.textContent = `${selected.length} departments selected`; }
                } else {
                    if (selected.length === total && selectAll) { freshBtn.textContent = 'All Departments'; }
                    else if (selected.length === 1) { freshBtn.textContent = selected[0]; }
                    else { freshBtn.textContent = `${selected.length} departments selected`; }
                }
            }
        }
    }

    // Initialize secretary department checkbox handler
    // Expose initSecretaryDeptCheckbox globally for admin view
    window.initSecretaryDeptCheckbox = function(composeModal) {
        const sendToAllDeptCheckbox = composeModal.querySelector('#sendToAllDeptCheckbox');
        const selectedDepartmentsInput = composeModal.querySelector('#selectedDepartments');
        const isSecretary = window.currentUser && window.currentUser.role === 'secretary';
        const canCrossSend = window.currentUser?.canCrossSend || false;

        // If secretary has canCrossSend, they use admin-style dropdown
        // The dropdown will be initialized by loadDepartments() called from compose button handler
        if (isSecretary && canCrossSend) {
            return; // Dropdown will be handled by loadDepartments()
        }

        // Regular secretary: handle inline checkbox
        if (!sendToAllDeptCheckbox || !selectedDepartmentsInput) {
            return; // Not a secretary compose modal or elements don't exist
        }

        // Update hidden input when checkbox changes
        sendToAllDeptCheckbox.addEventListener('change', () => {
            if (isSecretary) {
                const secretaryDept = window.currentUser.department;
                if (sendToAllDeptCheckbox.checked && secretaryDept) {
                    selectedDepartmentsInput.value = secretaryDept;
                } else {
                    selectedDepartmentsInput.value = '';
                }
            }
        });

        // Initialize checkbox state when modal opens
        if (isSecretary) {
            // Default to unchecked - secretary must explicitly choose to send to all
            sendToAllDeptCheckbox.checked = false;
            selectedDepartmentsInput.value = '';
        }
    }

    // Initialize multi-select department UI
    function initDepartmentMultiSelect() {
        const select = document.getElementById('departmentSelect');
        const display = document.getElementById('selectedDepartmentsDisplay');
        if (!select || !display) {return;}

        // Handle "Select All" option
        select.addEventListener('change', () => {
            const selectedOptions = Array.from(select.selectedOptions);
            const allOption = selectedOptions.find(opt => opt.value === '__all__');

            if (allOption && allOption.selected) {
                // Select all departments except "All Departments" option
                Array.from(select.options).forEach(opt => {
                    if (opt.value && opt.value !== '__all__') {
                        opt.selected = true;
                    }
                });
                allOption.selected = false;
            }
            updateDepartmentDisplay();
        });

        function updateDepartmentDisplay() {
            const selected = Array.from(select.selectedOptions)
                .filter(opt => opt.value && opt.value !== '__all__');

            if (selected.length === 0) {
                display.innerHTML = '';
                display.style.display = 'none';
            } else {
                display.style.display = 'flex';
                display.innerHTML = selected.map(opt =>
                    `<span class="dept-tag-inline">${opt.textContent}<button type="button" class="remove-dept-inline" data-value="${opt.value}" title="Remove">&times;</button></span>`
                ).join('');

                // Add remove handlers
                display.querySelectorAll('.remove-dept-inline').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const value = e.target.closest('.remove-dept-inline').dataset.value;
                        const option = Array.from(select.options).find(opt => opt.value === value);
                        if (option) {
                            option.selected = false;
                        }
                        updateDepartmentDisplay();
                        // Trigger change event to update select
                        select.dispatchEvent(new Event('change'));
                    });
                });
            }
        }

        // Initial display update
        updateDepartmentDisplay();
    }

    // Removed - now using custom dropdown
    // eslint-disable-next-line no-unused-vars
    function initDepartmentSingleSelect() {
        const select = document.getElementById('departmentSelect');
        const display = document.getElementById('selectedDepartmentsDisplay');
        if (!select || !display) {return;}

        // Pre-select user's department
        const userDepartment = window.currentUser?.department || '';
        if (userDepartment && select.options.length > 0) {
            const deptOption = Array.from(select.options).find(opt => opt.value === userDepartment);
            if (deptOption) {
                select.value = userDepartment;
            }
        }

        select.addEventListener('change', () => {
            if (select.value) {
                display.style.display = 'flex';
                display.innerHTML = `<span class="dept-tag-inline">${select.selectedOptions[0].textContent}</span>`;
            } else {
                display.innerHTML = '';
                display.style.display = 'none';
            }
        });

        // Initial display
        if (select.value) {
            display.style.display = 'flex';
            display.innerHTML = `<span class="dept-tag-inline">${select.selectedOptions[0].textContent}</span>`;
        } else {
            display.style.display = 'none';
        }
    }

    // Back button
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            showDefaultView();
        });
    }

    // Navigation buttons
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentMemoIndex > 0) {
                currentMemoIndex--;
                displayMemo(currentMemoIndex);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentMemoIndex < filteredMemos.length - 1) {
                currentMemoIndex++;
                displayMemo(currentMemoIndex);
            }
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            if (!currentMemoId || currentMemoIndex < 0 || !filteredMemos[currentMemoIndex]) {return;}

            try {
                downloadBtn.disabled = true;

                const memo = filteredMemos[currentMemoIndex];
                const response = await fetch(`/api/log/memos/${currentMemoId}/download`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    const error = await response.json().catch(() => ({ message: 'Failed to download memo' }));
                    throw new Error(error.message || 'Failed to download memo');
                }

                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = blobUrl;
                const safeSubject = (memo.subject || 'Memo')
                    .replace(/[\\/:*?"<>|]+/g, '')
                    .trim()
                    .replace(/\s+/g, '_')
                    .substring(0, 80) || 'Memo';
                link.download = `${safeSubject}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
            } catch (error) {
                console.error('Download error:', error);
                showNotification(error.message || 'Error downloading memo', 'error');
            } finally {
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                }
            }
        });
    }

    // Star button
    if (starBtn) {
    starBtn.addEventListener('click', async () => {
        if (!currentMemoId) {return;}

        const memo = filteredMemos[currentMemoIndex];
        const newStarState = !memo.isStarred;

        try {
            const response = await fetch(`/api/log/memos/${currentMemoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isStarred: newStarState })
            });

            const data = await response.json();

            if (data.success) {
                memo.isStarred = newStarState;
                updateStarButton(newStarState);
                showNotification(newStarState ? 'Starred' : 'Unstarred', 'success');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error updating memo', 'error');
        }
    });
    }

    // Bulk archive button
    const bulkArchiveBtn = document.getElementById('bulkArchiveBtn');
    if (bulkArchiveBtn) {
        bulkArchiveBtn.addEventListener('click', async () => {
            const checkedBoxes = Array.from(document.querySelectorAll('.memo-checkbox')).filter(cb => cb.checked && cb.closest('.memo-item')?.style.display !== 'none');
            if (checkedBoxes.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'No Selection',
                    text: 'No memos selected',
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
                return;
            }

            const memoIds = checkedBoxes.map(cb => cb.dataset.memoId).filter(id => id);
            if (memoIds.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'No Selection',
                    text: 'No valid memos to archive',
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
                return;
            }

            try {
                // Archive all selected memos
                const archivePromises = memoIds.map(memoId =>
                    fetch(`/api/log/memos/${memoId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'archived' })
                    }).then(res => res.json())
                );

                const results = await Promise.all(archivePromises);
                const successCount = results.filter(r => r.success).length;

                if (successCount > 0) {
                    // Show SweetAlert success notification
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: `Archived ${successCount} memo${successCount > 1 ? 's' : ''}`,
                        timer: 2000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                    // Uncheck all checkboxes
                    checkedBoxes.forEach(cb => {
                        cb.checked = false;
                    });
                    updateSelectionUI();
                    // Refresh memo list
                    fetchMemos();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Failed',
                        text: 'Failed to archive memos',
                        timer: 2000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            } catch (error) {
                console.error('Error archiving memos:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error archiving memos',
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            }
        });
    }

    // Archive button (single memo)
    if (archiveBtn) {
        archiveBtn.addEventListener('click', async () => {
            if (!currentMemoId) {return;}

        // Store the memo for potential undo
        const memoToArchive = filteredMemos[currentMemoIndex];
        const archivedMemoIndex = currentMemoIndex;
        const archivedMemoId = currentMemoId;

        try {
            const response = await fetch(`/api/log/memos/${currentMemoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'archived' })
            });

            const data = await response.json();

            if (data.success) {
                // Show SweetAlert toast notification
                Swal.fire({
                    icon: 'success',
                    title: 'Memo Archived',
                    text: 'Memo has been archived successfully',
                    timer: 3000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end',
                    showCancelButton: false
                });

                // Remove from lists
                memos = memos.filter(m => m._id !== currentMemoId);
                filteredMemos = filteredMemos.filter(m => m._id !== currentMemoId);

                // If archived memo was the current one, go to default view
                if (currentMemoId === archivedMemoId) {
                    showDefaultView();
                }

                renderMemoList();
                fetchMemos();
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error archiving memo', 'error');
        }
        });
    }

    // Undo archive -> set status back to 'sent' (or 'approved' if previously)
    async function undoArchive(index, memoObj) {
        try {
            const response = await fetch(`/api/log/memos/${memoObj._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'sent' })
            });
            const data = await response.json();
            if (data && data.success) {
                // Insert back in lists
                memos.splice(index, 0, memoObj);
                filteredMemos.splice(index, 0, memoObj);
                Swal.fire({
                    icon: 'success',
                    title: 'Archive Undone',
                    text: 'Memo has been restored',
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
                renderMemoList();
                fetchMemos();
            }
        } catch (e) {
            console.error('Undo archive failed:', e);
            Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: 'Failed to undo archive',
                timer: 2000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
            });
        }
    }

    // Fetch memos
    async function fetchMemos() {
        // Only fetch if memoList exists (we're on memos page, not dashboard)
        if (!memoList) {
            return;
        }
        try {
            // If "Sent by Me" filter is active, fetch from sent folder
            const folderToFetch = currentSort === 'sent' ? 'sent' : currentFolder;
            const response = await fetch(`/api/log/memos?folder=${folderToFetch}`);
            const data = await response.json();

            if (data.success) {
                memos = data.memos;
                applyFilters();
            } else {
                showNotification(data.message || 'Error fetching memos', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error fetching memos', 'error');
        }
    }

    // Apply filters (department, priority, search, date, sent) and sorting
    function applyFilters() {
        // Only apply filters if memoList exists (we're on memos page, not dashboard)
        if (!memoList) {
            return;
        }
        // Start with all memos
        filteredMemos = [...memos];

        // Filter by department
        if (currentDeptFilter !== 'all') {
            filteredMemos = filteredMemos.filter(memo => {
                return memo.department === currentDeptFilter ||
                       memo.sender?.department === currentDeptFilter ||
                       memo.recipient?.department === currentDeptFilter;
            });
        }

        // Filter by priority
        if (currentPriorityFilter !== 'all') {
            filteredMemos = filteredMemos.filter(memo => {
                const memoPriority = memo.priority || 'medium';
                return memoPriority === currentPriorityFilter;
            });
        }

        // Filter by date
        if (currentDateFilter) {
            filteredMemos = filteredMemos.filter(memo => {
                if (!memo.createdAt) {
                    return false;
                }
                const memoDate = new Date(memo.createdAt);
                const filterDate = new Date(currentDateFilter);
                // Compare dates (ignore time)
                return memoDate.getFullYear() === filterDate.getFullYear() &&
                       memoDate.getMonth() === filterDate.getMonth() &&
                       memoDate.getDate() === filterDate.getDate();
            });
        }

        // Filter by "Sent by Me" (check if current user is sender)
        if (currentSort === 'sent') {
            const currentUserId = window.currentUser?.id;
            const currentUserEmail = window.currentUser?.email?.toLowerCase();

            if (currentUserId) {
                filteredMemos = filteredMemos.filter(memo => {
                    if (!memo.sender) {
                        return false;
                    }

                    // Check if sender ID matches current user ID (try multiple formats)
                    let senderId;
                    if (typeof memo.sender === 'object' && memo.sender._id) {
                        senderId = memo.sender._id.toString();
                    } else if (typeof memo.sender === 'object' && memo.sender.id) {
                        senderId = memo.sender.id.toString();
                    } else {
                        senderId = memo.sender.toString();
                    }

                    const senderEmail = memo.sender.email?.toLowerCase();

                    // Match by ID or email (in case ID format differs)
                    const matchesById = senderId === currentUserId.toString();
                    const matchesByEmail = currentUserEmail && senderEmail && senderEmail === currentUserEmail;

                    return matchesById || matchesByEmail;
                });
            } else {
                // If no user ID, show no results
                filteredMemos = [];
            }
        }

        // Filter by search term
        if (currentSearchTerm) {
            filteredMemos = filteredMemos.filter(memo => {
                const searchLower = currentSearchTerm.toLowerCase();
                const subject = (memo.subject || '').toLowerCase();
                const content = (memo.content || '').toLowerCase();
                const senderName = `${memo.sender?.firstName || ''} ${memo.sender?.lastName || ''}`.toLowerCase();
                const senderEmail = (memo.sender?.email || '').toLowerCase();
                const activityType = (memo.activityType || '').toLowerCase();

                return subject.includes(searchLower) ||
                       content.includes(searchLower) ||
                       senderName.includes(searchLower) ||
                       senderEmail.includes(searchLower) ||
                       activityType.includes(searchLower);
            });
        }

        // Apply sorting (only if not "sent" filter, which is already a filter)
        if (currentSort !== 'sent') {
            sortMemos();
        } else {
            // For "sent" filter, sort by newest first
            filteredMemos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        // Reset selection if current index is invalid after filtering
        if (currentMemoIndex >= 0 && currentMemoIndex >= filteredMemos.length) {
            currentMemoIndex = -1;
            currentMemoId = null;
            // Hide memo viewer if no valid memo
            if (memoViewer) {
                memoViewer.style.display = 'none';
            }
            if (emptyState) {
                emptyState.style.display = 'flex';
            }
        }

        // Update memo counter
        if (memoCounter) {
            if (currentMemoIndex >= 0 && currentMemoIndex < filteredMemos.length) {
                memoCounter.textContent = `${currentMemoIndex + 1} of ${filteredMemos.length}`;
            } else {
                // No memo selected
                if (filteredMemos.length > 0) {
                    memoCounter.textContent = `0 of ${filteredMemos.length}`;
                } else {
                    memoCounter.textContent = '0 of 0';
                }
            }
        }

        renderMemoList();
    }

    // Sort memos based on current sort option
    function sortMemos() {
        if (currentSort === 'newest') {
            filteredMemos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (currentSort === 'oldest') {
            filteredMemos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        } else if (currentSort === 'priority') {
            // Priority order: urgent > high > medium > low
            const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
            filteredMemos.sort((a, b) => {
                const aPriority = priorityOrder[a.priority || 'medium'] || 2;
                const bPriority = priorityOrder[b.priority || 'medium'] || 2;
                if (bPriority !== aPriority) {
                    return bPriority - aPriority; // Higher priority first
                }
                // If same priority, sort by date (newest first)
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
        } else if (currentSort === 'subject') {
            filteredMemos.sort((a, b) => {
                const aSubject = (a.subject || '').toLowerCase();
                const bSubject = (b.subject || '').toLowerCase();
                return aSubject.localeCompare(bSubject);
            });
        } else if (currentSort === 'sender') {
            filteredMemos.sort((a, b) => {
                const aName = `${a.sender?.firstName || ''} ${a.sender?.lastName || ''}`.toLowerCase();
                const bName = `${b.sender?.firstName || ''} ${b.sender?.lastName || ''}`.toLowerCase();
                return aName.localeCompare(bName);
            });
        }
        // Note: 'sent' is handled as a filter in applyFilters(), not a sort
    }

    // Render memo list
    function renderMemoList() {
        // Only render if memoList exists (we're on memos page, not dashboard)
        if (!memoList) {
            return;
        }
        if (filteredMemos.length === 0) {
            memoList.innerHTML = '<div style="padding: 40px; text-align: center; color: #9ca3af;">No memos found</div>';
            return;
        }

        // Determine if we're viewing sent or received memos
        const isSentFolder = currentFolder === 'sent';

        memoList.innerHTML = filteredMemos.map((memo, index) => {
            // Check if this is a calendar event notification
            const isCalendarEvent = (memo.metadata && memo.metadata.eventType === 'calendar_event') ||
                                   (memo.subject && memo.subject.includes('Calendar Event')) ||
                                   (memo.activityType === 'system_notification' && memo.subject && memo.subject.includes('📅'));

            // Calendar events have a different format
            if (isCalendarEvent) {
                // Parse calendar event content to extract info
                let eventTitle = memo.subject || 'Calendar Event';
                let eventDate = '';
                let eventTime = '';
                let eventCategory = '';

                if (memo.content) {
                    const lines = memo.content.split('\n').filter(l => l.trim());
                    if (lines.length > 0) {
                        eventTitle = lines[0].trim();
                    }
                    lines.forEach(line => {
                        if (line.startsWith('Date:')) {eventDate = line.replace('Date:', '').trim();}
                        if (line.startsWith('Time:')) {eventTime = line.replace('Time:', '').trim();}
                        if (line.startsWith('Category:')) {eventCategory = line.replace('Category:', '').trim();}
                    });
                }

                // Category color indicator
                let categoryColor = '#86efac'; // Default green (Standard)
                let categoryLabel = 'Standard';
                if (eventCategory.includes('Urgent') || eventCategory.includes('🔴')) {
                    categoryColor = '#f87171';
                    categoryLabel = 'Urgent';
                } else if (eventCategory.includes('Today') || eventCategory.includes('🟡')) {
                    categoryColor = '#fbbf24';
                    categoryLabel = 'Today';
                }

                return `
                <div class="memo-item calendar-event-item ${index === currentMemoIndex ? 'active' : ''}"
                     data-id="${memo._id}"
                     data-index="${index}"
                     style="border-left: 4px solid ${categoryColor}; background: linear-gradient(to right, ${categoryColor}15 0%, transparent 5%);">
                    <div class="memo-item-header" style="align-items: flex-start;">
                        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                            <div style="width: 48px; height: 48px; border-radius: 8px; background: ${categoryColor}20; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                <i data-lucide="calendar" style="width: 24px; height: 24px; color: ${categoryColor};"></i>
                            </div>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <span style="font-weight: 600; color: #111827; font-size: 14px;">${eventTitle}</span>
                                    <span style="padding: 2px 8px; background: ${categoryColor}20; color: ${categoryColor}; border-radius: 4px; font-size: 11px; font-weight: 500;">${categoryLabel}</span>
                                </div>
                                ${eventDate ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 2px;">📅 ${eventDate}</div>` : ''}
                                ${eventTime ? `<div style="font-size: 12px; color: #6b7280;">🕐 ${eventTime}</div>` : ''}
                            </div>
                        </div>
                        <div class="memo-item-actions">
                            ${memo.isStarred ? '<i data-lucide="star" style="width: 16px; height: 16px; color: #fbbf24;"></i>' : ''}
                        </div>
                    </div>
                    <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">${formatDate(memo.createdAt)}</div>
                </div>
            `;
            }

            // Regular memo format (unchanged)
            // For sent folder: show recipient info and "Sent:" prefix
            // For inbox/other folders: show sender info (default)
            // Special case: If current user is the sender, show "To:" (recipients) instead of "From:"
            // Special case: For admin approval/rejection actions, show "You:" instead of "From:"
            let displayUser, displayLabel, subjectPrefix;

            // Check if this is an admin approval/rejection action memo
            const eventType = memo.metadata?.eventType;
            const isAdminActionMemo = (eventType === 'memo_approved_by_admin' || eventType === 'memo_rejected_by_admin');
            const currentUserId = window.currentUser?.id || window.currentUser?._id;
            const currentUserEmail = window.currentUser?.email?.toLowerCase();
            const isCurrentUserAdmin = window.currentUser?.role === 'admin';
            const isRecipientCurrentUser = memo.recipient && (
                (memo.recipient._id?.toString() === currentUserId?.toString()) ||
                (memo.recipient.toString() === currentUserId?.toString())
            );

            // Check if current user is the sender of this memo
            const isCurrentUserSender = memo.sender && (
                (memo.sender._id?.toString() === currentUserId?.toString()) ||
                (memo.sender.toString() === currentUserId?.toString()) ||
                (memo.sender.email?.toLowerCase() === currentUserEmail)
            );

            if (isSentFolder) {
                // Sent folder: show recipient (who we sent it to)
                displayUser = memo.recipient;
                displayLabel = 'To';
                subjectPrefix = 'Sent: ';
            } else if (isCurrentUserSender) {
                // Current user created this memo: show recipients (who we sent it to)
                displayUser = memo.recipient;
                displayLabel = 'To';
                subjectPrefix = '';
            } else {
                // Inbox/Received: show sender (who sent it to us)
                // This includes admin-approved/rejected memos from secretary - show "From: [Secretary]"
                displayUser = memo.sender;
                displayLabel = 'From';
                subjectPrefix = '';
            }

            const displayName = displayUser ? `${displayUser.firstName || ''} ${displayUser.lastName || ''}`.trim() : 'Unknown';
            const displayEmail = displayUser?.email || 'N/A';
            const avatarSrc = displayUser?.profilePicture || '/images/memofy-logo.png';
            const subject = subjectPrefix + (memo.subject || '(No subject)');
            const contentPreview = memo.content ? `- ${memo.content.substring(0, 50)}${memo.content.length > 50 ? '...' : ''}` : '- (No content)';

            // Action badge (Approved/Rejected Memo)
            let actionBadge = '';
            const memoStatus = memo.status?.toLowerCase();
            if (eventType === 'memo_approved_by_admin' || memoStatus === 'approved') {
                actionBadge = '<span class="action-badge approved-badge" title="Approved Memo" style="display: inline-block; padding: 4px 10px; background: #10b981; color: white; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px; text-transform: uppercase;">✓ Approved Memo</span>';
            } else if (eventType === 'memo_rejected_by_admin' || memoStatus === 'rejected') {
                actionBadge = '<span class="action-badge rejected-badge" title="Rejected Memo" style="display: inline-block; padding: 4px 10px; background: #ef4444; color: white; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px; text-transform: uppercase;">✗ Rejected Memo</span>';
            }

            // Priority badge
            const priority = memo.priority || 'medium';
            let priorityBadge = '';
            if (priority === 'urgent') {
                priorityBadge = '<span class="priority-badge priority-urgent" title="Urgent">🔴 URGENT</span>';
            } else if (priority === 'high') {
                priorityBadge = '<span class="priority-badge priority-high" title="High">🟠 HIGH</span>';
            } else if (priority === 'medium') {
                priorityBadge = '<span class="priority-badge priority-medium" title="Medium">🟡 MEDIUM</span>';
            } else if (priority === 'low') {
                priorityBadge = '<span class="priority-badge priority-low" title="Low">🔵 LOW</span>';
            }

            return `
            <div class="memo-item ${index === currentMemoIndex ? 'active' : ''}"
                 data-id="${memo._id}"
                 data-index="${index}"
                 style="display: flex; align-items: flex-start; gap: 0;">
                <input type="checkbox" class="memo-checkbox" data-memo-id="${memo._id}" data-index="${index}" style="margin: 12px 12px 0 12px; cursor: pointer; flex-shrink: 0;">
                <div style="flex: 1; min-width: 0;">
                    <div class="memo-item-header">
                        <img src="${avatarSrc}"
                             alt="${displayName}"
                             class="memo-avatar">
                        <div class="memo-sender-info">
                            <div class="memo-sender-name">${displayLabel}: ${displayName}</div>
                            <div class="memo-sender-email">${displayEmail}</div>
                        </div>
                        <div class="memo-item-actions">
                            ${priorityBadge}
                            ${memo.isStarred ? '<i data-lucide="star" style="width: 16px; height: 16px; color: #fbbf24;"></i>' : ''}
                        </div>
                    </div>
                    <div class="memo-subject">${subject}${actionBadge}</div>
                    <div class="memo-preview">${contentPreview}</div>
                    <div class="memo-date">${formatDate(memo.createdAt)}</div>
                </div>
            </div>
        `;
        }).join('');

        // Reset select dropdown state
        if (selectDropdownWrapper) {
            selectDropdownWrapper.classList.remove('open');
        }

        // Reinitialize Lucide icons
        lucide.createIcons();

        // Add click listeners
        document.querySelectorAll('.memo-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't trigger if clicking on checkbox
                if (e.target.type === 'checkbox' || e.target.closest('.memo-checkbox')) {
                    e.stopPropagation();
                    const checkbox = e.target.type === 'checkbox' ? e.target : e.target.closest('.memo-checkbox');
                    if (checkbox) {
                        updateSelectionUI();
                    }
                    return;
                }
                const index = parseInt(item.dataset.index);
                selectMemo(index);
            });
        });

        // Add checkbox change listeners
        document.querySelectorAll('.memo-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                updateSelectionUI();
            });
        });

        // Update selection UI (archive button visibility, selectDropdown icon)
        updateSelectionUI();
    }

    // Select memo
    function selectMemo(index) {
        currentMemoIndex = index;
        currentMemoId = filteredMemos[index]._id;
        console.log('Selecting memo at index:', index, 'ID:', currentMemoId);

        // Re-render list to highlight selected memo
        renderMemoList();

        // Then display the memo
        displayMemo(index);
    }

    // Attachment Viewer Modal Functions
    function createAttachmentModal() {
        // Check if modal already exists
        if (document.getElementById('attachmentViewerModal')) {
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'attachmentViewerModal';
        modal.className = 'modal';
        modal.style.cssText = 'display: none; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.9); overflow: auto;';
        modal.innerHTML = `
            <div class="attachment-modal-content" style="position: relative; background-color: #fff; margin: 2% auto; padding: 0; width: 90%; max-width: 1200px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-height: 90vh; display: flex; flex-direction: column;">
                <div class="attachment-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb;">
                    <div style="flex: 1;">
                        <h3 id="attachmentFileName" style="margin: 0; font-size: 1.125rem; font-weight: 600; color: #111827;"></h3>
                        <p id="attachmentFileSize" style="margin: 0.25rem 0 0 0; font-size: 0.875rem; color: #6b7280;"></p>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button id="attachmentPrevBtn" class="attachment-nav-btn" style="display: none; padding: 0.5rem; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer;" title="Previous">
                            <i data-lucide="chevron-left" style="width: 20px; height: 20px;"></i>
                        </button>
                        <button id="attachmentNextBtn" class="attachment-nav-btn" style="display: none; padding: 0.5rem; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer;" title="Next">
                            <i data-lucide="chevron-right" style="width: 20px; height: 20px;"></i>
                        </button>
                        <a id="attachmentDownloadBtn" href="#" download style="padding: 0.5rem; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center;" title="Download">
                            <i data-lucide="download" style="width: 20px; height: 20px; color: #374151;"></i>
                        </a>
                        <button id="attachmentCloseBtn" style="padding: 0.5rem; background: #f3f4f6; border: none; border-radius: 6px; cursor: pointer; font-size: 1.5rem; line-height: 1; color: #6b7280;" title="Close">×</button>
                    </div>
                </div>
                <div id="attachmentViewerBody" style="flex: 1; overflow: auto; padding: 1.5rem; display: flex; align-items: center; justify-content: center; min-height: 400px; background: #f9fafb;">
                    <div id="attachmentViewerContent" style="width: 100%; text-align: center;"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = document.getElementById('attachmentCloseBtn');
        const prevBtn = document.getElementById('attachmentPrevBtn');
        const nextBtn = document.getElementById('attachmentNextBtn');
        const downloadBtn = document.getElementById('attachmentDownloadBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', closeAttachmentModal);
        }

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAttachmentModal();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                closeAttachmentModal();
            }
        });

        if (prevBtn) {
            prevBtn.addEventListener('click', () => showPreviousAttachment());
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => showNextAttachment());
        }

        if (typeof lucide !== 'undefined') {
            // eslint-disable-next-line no-undef
            lucide.createIcons();
        }
    }

    let currentAttachments = [];
    let currentAttachmentIndex = 0;

    function openAttachmentModal(attachments, index) {
        currentAttachments = attachments;
        currentAttachmentIndex = index;
        createAttachmentModal();
        showAttachment(currentAttachmentIndex);
        const modal = document.getElementById('attachmentViewerModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    function closeAttachmentModal() {
        const modal = document.getElementById('attachmentViewerModal');
        if (modal) {
            modal.style.display = 'none';
        }
        currentAttachments = [];
        currentAttachmentIndex = 0;
    }

    function showAttachment(index) {
        if (!currentAttachments || currentAttachments.length === 0 || index < 0 || index >= currentAttachments.length) {
            return;
        }

        const attachment = currentAttachments[index];
        const attachmentUrl = attachment.url || `/uploads/${attachment.filename}`;
        const isPDF = attachment.mimetype === 'application/pdf';
        const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');

        const fileNameEl = document.getElementById('attachmentFileName');
        const fileSizeEl = document.getElementById('attachmentFileSize');
        const contentEl = document.getElementById('attachmentViewerContent');
        const downloadBtn = document.getElementById('attachmentDownloadBtn');
        const prevBtn = document.getElementById('attachmentPrevBtn');
        const nextBtn = document.getElementById('attachmentNextBtn');

        if (fileNameEl) {
            fileNameEl.textContent = attachment.filename || 'Attachment';
        }
        if (fileSizeEl) {
            fileSizeEl.textContent = `${formatFileSize(attachment.size || 0)} • ${index + 1} of ${currentAttachments.length}`;
        }
        if (downloadBtn) {
            downloadBtn.href = attachmentUrl;
            downloadBtn.download = attachment.filename;
        }

        // Show/hide navigation buttons
        if (prevBtn) {
            prevBtn.style.display = currentAttachments.length > 1 ? 'block' : 'none';
        }
        if (nextBtn) {
            nextBtn.style.display = currentAttachments.length > 1 ? 'block' : 'none';
        }

        // Display content
        if (contentEl) {
            if (isImage) {
                contentEl.innerHTML = `<img src="${attachmentUrl}" alt="${attachment.filename}" style="max-width: 100%; max-height: calc(90vh - 200px); height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />`;
            } else if (isPDF) {
                contentEl.innerHTML = `<iframe src="${attachmentUrl}#toolbar=1" style="width: 100%; height: calc(90vh - 200px); border: none; border-radius: 8px;" title="${attachment.filename}"></iframe>`;
            } else {
                contentEl.innerHTML = `
                    <div style="padding: 3rem; text-align: center;">
                        <i data-lucide="file" style="width: 64px; height: 64px; color: #9ca3af; margin-bottom: 1rem;"></i>
                        <p style="color: #6b7280; margin: 0.5rem 0;">This file type cannot be previewed.</p>
                        <a href="${attachmentUrl}" download="${attachment.filename}" style="display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">Download File</a>
                    </div>
                `;
            }
        }

        if (typeof lucide !== 'undefined') {
            // eslint-disable-next-line no-undef
            lucide.createIcons();
        }
    }

    function showPreviousAttachment() {
        if (currentAttachmentIndex > 0) {
            currentAttachmentIndex--;
            showAttachment(currentAttachmentIndex);
        }
    }

    function showNextAttachment() {
        if (currentAttachmentIndex < currentAttachments.length - 1) {
            currentAttachmentIndex++;
            showAttachment(currentAttachmentIndex);
        }
    }

    // Attach click handlers to attachment links and images
    function attachAttachmentHandlers(memo) {
        if (!memo || !memo.attachments || memo.attachments.length === 0) {
            return;
        }

        const memoBodyContent = document.getElementById('memoBodyContent');
        if (!memoBodyContent) {
            return;
        }

        // Find all attachment links and images
        const attachmentLinks = memoBodyContent.querySelectorAll('.attachment-link');
        const attachmentImages = memoBodyContent.querySelectorAll('.attachment-image-preview');

        // Helper function to find attachment index by filename or URL
        function findAttachmentIndex(filename, url) {
            return memo.attachments.findIndex(att => {
                return att.filename === filename ||
                       att.url === url ||
                       att.filename === decodeURIComponent(filename);
            });
        }

        attachmentLinks.forEach((link) => {
            const filename = link.dataset.filename || link.textContent.trim();
            const url = link.dataset.url;
            const attIndex = findAttachmentIndex(filename, url);

            if (attIndex >= 0) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    openAttachmentModal(memo.attachments, attIndex);
                });
            }
        });

        attachmentImages.forEach((img) => {
            const filename = img.dataset.filename || img.alt;
            const url = img.dataset.url || img.src;
            const attIndex = findAttachmentIndex(filename, url);

            if (attIndex >= 0) {
                img.addEventListener('click', () => {
                    openAttachmentModal(memo.attachments, attIndex);
                });
            }
        });
    }

    // Display memo
    function displayMemo(index) {
        let memo = filteredMemos[index];

        // Validate memo exists
        if (!memo) {
            // eslint-disable-next-line no-console
            console.error('Memo not found at index:', index);
            showNotification('Memo not found', 'error');
            return;
        }

        // If memo doesn't have signatures but has an ID, fetch full memo to get signatures
        // Always fetch full memo to ensure recipients are populated correctly
        if (memo._id) {
            fetch(`/api/log/memos/${memo._id}`, { credentials: 'same-origin' })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.memo) {
                        // Update the memo in filteredMemos with full data including signatures
                        const memoIndex = filteredMemos.findIndex(m => m._id === memo._id);
                        if (memoIndex !== -1) {
                            filteredMemos[memoIndex] = data.memo;
                            memo = data.memo;
                        }
                        // Continue with display
                        displayMemoContent(memo);
                    } else {
                        displayMemoContent(memo);
                    }
                })
                .catch(err => {
                    console.error('Error fetching full memo:', err);
                    displayMemoContent(memo);
                });
            return;
        }

        displayMemoContent(memo);
    }

    function displayMemoContent(memo) {

        // Show viewer first before trying to access elements
        showMemoViewer();
        if (downloadBtn) {downloadBtn.disabled = false;}

        // Update archive buttons if function exists (for secretary memos page)
        if (typeof updateArchiveButtons === 'function') {
            updateArchiveButtons(memo);
        }

        // Detect calendar event memos and toggle the MEMO header visibility
        const isCalendarEvent = (memo.metadata && memo.metadata.eventType === 'calendar_event') ||
                               (memo.subject && memo.subject.includes('Calendar Event')) ||
                               (memo.activityType === 'system_notification' && memo.subject && memo.subject.includes('📅'));

        // Do not redirect calendar memos to the calendar; show them here in the memo viewer
        const memoPdfHeader = document.querySelector('.memo-pdf-header');
        if (memoPdfHeader) {
            memoPdfHeader.style.display = isCalendarEvent ? 'none' : 'block';
        }

        // Update the memo viewer content (now that it's visible)
        const memoDetailSubject = document.getElementById('memoDetailSubject');
        const memoDetailFrom = document.getElementById('memoDetailFrom');
        const memoDetailTo = document.getElementById('memoDetailTo');
        const memoDetailDepartment = document.getElementById('memoDetailDepartment');
        const memoDetailPriority = document.getElementById('memoDetailPriority');
        const memoDetailDate = document.getElementById('memoDetailDate');
        const memoBodyContent = document.getElementById('memoBodyContent');
        const attachmentsDiv = document.getElementById('attachments');

        // Update memo details (PDF-style format)
        if (memoDetailSubject) {
            memoDetailSubject.textContent = memo.subject || '(No subject)';
        }

        if (memoDetailFrom) {
            // Check if this is an admin approval/rejection action memo
            const eventType = memo.metadata?.eventType;
            const isAdminActionMemo = (eventType === 'memo_approved_by_admin' || eventType === 'memo_rejected_by_admin');
            const currentUserId = window.currentUser?.id || window.currentUser?._id;
            const isCurrentUserAdmin = window.currentUser?.role === 'admin';
            const isRecipientCurrentUser = memo.recipient && (
                (memo.recipient._id?.toString() === currentUserId?.toString()) ||
                (memo.recipient.toString() === currentUserId?.toString())
            );

            let displayName, displayEmail, displayLabel;
            if (isAdminActionMemo && isCurrentUserAdmin && isRecipientCurrentUser) {
                // Admin approval/rejection action: show "You:" instead of "From:"
                displayLabel = 'You';
                displayName = window.currentUser?.firstName && window.currentUser?.lastName
                    ? `${window.currentUser.firstName} ${window.currentUser.lastName}`.trim()
                    : window.currentUser?.email || 'You';
                displayEmail = window.currentUser?.email || '';
            } else {
                // Regular memo: show sender
                displayLabel = 'From';
                displayName = memo.sender
                    ? `${memo.sender.firstName || ''} ${memo.sender.lastName || ''}`.trim()
                    : 'Unknown Sender';
                displayEmail = memo.sender?.email || '';
            }

            // Update the label (find the label element that comes before memoDetailFrom)
            const fromRow = memoDetailFrom.closest('.memo-detail-row');
            if (fromRow) {
                const labelElement = fromRow.querySelector('.memo-detail-label');
                if (labelElement) {
                    labelElement.textContent = displayLabel + ':';
                }
            }

            memoDetailFrom.textContent = displayEmail ? `${displayName} (${displayEmail})` : displayName;
        }

        if (memoDetailTo) {
            // Get all recipients (from recipients array or single recipient)
            const allRecipients = [];
            if (memo.recipients && memo.recipients.length > 0) {
                allRecipients.push(...memo.recipients);
            } else if (memo.recipient) {
                allRecipients.push(memo.recipient);
            }

            if (allRecipients.length > 0) {
                // Format recipients list
                const recipientList = allRecipients.map(recip => {
                    // Handle both populated objects and ObjectIds
                    if (typeof recip === 'string' || recip instanceof Object && !recip.firstName && !recip.email) {
                        // It's an ObjectId, skip it (shouldn't happen if populated correctly)
                        return null;
                    }
                    const name = `${recip.firstName || ''} ${recip.lastName || ''}`.trim();
                    const email = recip.email || '';
                    return email ? `${name} (${email})` : name || email || 'Unknown';
                }).filter(Boolean).join(', ');
                memoDetailTo.textContent = recipientList || 'Unknown Recipient';
            } else {
                memoDetailTo.textContent = 'Unknown Recipient';
            }
        }

        if (memoDetailDepartment) {
            memoDetailDepartment.textContent = memo.department || 'N/A';
        }

        if (memoDetailPriority) {
            memoDetailPriority.textContent = memo.priority || 'medium';
        }

        if (memoDetailDate && memo.createdAt) {
            const date = new Date(memo.createdAt);
            memoDetailDate.textContent = date.toLocaleString();
        }

        // Display memo content with attachments (Gmail-style: inline, no separator)
        if (memoBodyContent) {
            let htmlContent = '';

            // Check if this is a calendar event notification
            const isCalendarEvent = (memo.metadata && memo.metadata.eventType === 'calendar_event') ||
                                   (memo.subject && memo.subject.includes('Calendar Event')) ||
                                   (memo.activityType === 'system_notification' && memo.subject && memo.subject.includes('📅'));

            // Display text content - handle empty content gracefully
            const memoText = memo.content || '';
            if (memoText && memoText.trim()) {
                // Remove markdown asterisks and any trailing "View the calendar..." line for calendar events
                let formattedContent = memoText;
                if (isCalendarEvent) {
                    formattedContent = formattedContent
                        .replace(/\*\*/g, '')
                        .split('\n')
                        .filter(line => !/\bview\s+the\s+calendar\b/i.test(line))
                        .join('\n');
                }
                const safeContent = formattedContent
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
                htmlContent += `<div style="white-space: pre-wrap; margin-bottom: ${memo.attachments && memo.attachments.length > 0 ? '1rem' : '0'}; line-height: 1.6; color: #111827;">${safeContent}</div>`;
            } else {
                // Show message if content is empty but still show attachments if any
                htmlContent += `<div style="color: #9ca3af; font-style: italic; margin-bottom: ${memo.attachments && memo.attachments.length > 0 ? '1rem' : '0'}; line-height: 1.6;">No text content</div>`;
            }

            // Ensure content is always visible even if htmlContent is empty
            if (!htmlContent && (!memo.attachments || memo.attachments.length === 0)) {
                htmlContent = '<div style="color: #9ca3af; font-style: italic; line-height: 1.6;">This memo has no content.</div>';
            }

            // Add rejection reason display if memo was rejected
            // Check for various rejection indicators:
            // 1. Direct rejected status
            // 2. Rejected by admin event type
            // 3. Rejection notification (system_notification with rejected action)
            // 4. Memo rejected activity type
            const isRejected = memo.status === 'rejected' ||
                              (memo.metadata && memo.metadata.eventType === 'memo_rejected_by_admin') ||
                              (memo.activityType === 'memo_rejected') ||
                              (memo.activityType === 'system_notification' && memo.metadata?.action === 'rejected') ||
                              (memo.metadata?.eventType === 'memo_review_decision' && memo.metadata?.action === 'rejected');

            // Extract rejection reason from various possible locations
            if (isRejected) {
                let rejectionReason = '';

                // Priority order: metadata.rejectionReason > metadata.reason > parse from content
                if (memo.metadata?.rejectionReason) {
                    rejectionReason = memo.metadata.rejectionReason;
                } else if (memo.metadata?.reason) {
                    rejectionReason = memo.metadata.reason;
                } else if (memoText && memoText.includes('Reason:')) {
                    // Parse reason from content like "was rejected by admin@buksu.edu.ph\nReason: ..."
                    const reasonMatch = memoText.match(/Reason:\s*(.+?)(?:\n|$)/i);
                    if (reasonMatch && reasonMatch[1]) {
                        rejectionReason = reasonMatch[1].trim();
                    }
                }

                // Only show rejection reason box if we have a reason or if it's a rejection notification
                if (rejectionReason || (memo.activityType === 'system_notification' && memo.metadata?.action === 'rejected')) {
                    if (!rejectionReason) {
                        rejectionReason = 'No reason provided';
                    }
                    const safeReason = rejectionReason
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#039;');
                    htmlContent += `
                        <div style="margin-top: 24px; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <i data-lucide="alert-circle" style="width: 20px; height: 20px; color: #ef4444;"></i>
                                <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #991b1b;">Rejection Reason</h4>
                            </div>
                            <div style="color: #7f1d1d; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
                                ${safeReason}
                            </div>
                        </div>
                    `;
                }
            }

            // Add attachments inline below text (Gmail style - no separator line or heading)
            if (memo.attachments && memo.attachments.length > 0) {
                // No border-top, no "Attachments:" heading - just show files inline below text
                htmlContent += '<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0;">';

                memo.attachments.forEach((attachment, attIndex) => {
                    const attachmentUrl = attachment.url || `/uploads/${attachment.filename}`;
                    const isPDF = attachment.mimetype === 'application/pdf';
                    const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');
                    const attachmentId = `attachment-${memo._id}-${attIndex}`;

                    // Gmail-style attachment chip (subtle, no heavy card look)
                    if (isPDF || !isImage) {
                        htmlContent += `
                            <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 13px;">
                                <i data-lucide="${isPDF ? 'file-text' : 'paperclip'}" style="width: 16px; height: 16px; color: #6b7280;"></i>
                                <span class="attachment-link" data-url="${attachmentUrl}" data-filename="${attachment.filename}" data-mimetype="${attachment.mimetype || ''}" data-size="${attachment.size || 0}" style="color: #2563eb; text-decoration: none; font-weight: 500; cursor: pointer;" title="View">${attachment.filename}</span>
                                <span style="font-size: 12px; color: #6b7280;">(${formatFileSize(attachment.size || 0)})</span>
                            </div>
                        `;
                    } else if (isImage) {
                        // For images, show inline preview below text (Gmail style)
                        // Image preview is clickable to open modal (no link text needed)
                        htmlContent += `
                            <div style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
                                <img src="${attachmentUrl}" alt="${attachment.filename}" class="attachment-image-preview" data-url="${attachmentUrl}" data-filename="${attachment.filename}" data-mimetype="${attachment.mimetype || ''}" style="max-width: 100%; max-height: 400px; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer;" title="Click to view in modal (with download option)" />
                            </div>
                        `;
                    }
                });

                htmlContent += '</div>';
            }

            // Add signatures if present
            if (memo.signatures && Array.isArray(memo.signatures) && memo.signatures.length > 0) {
                htmlContent += '<div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">';
                htmlContent += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 1rem;">';

                memo.signatures.forEach(sig => {
                    const name = sig.displayName || sig.roleTitle || sig.role || '';
                    const title = sig.roleTitle || sig.role || '';
                    const imgSrc = sig.imageUrl || '';

                    htmlContent += '<div style="text-align: center;">';
                    if (imgSrc) {
                        htmlContent += `<img src="${imgSrc}" alt="${name}" style="max-width: 180px; max-height: 60px; object-fit: contain; margin-bottom: 8px;" onerror="this.style.display='none'">`;
                    } else {
                        htmlContent += '<div style="height: 60px; margin-bottom: 8px;"></div>';
                    }
                    htmlContent += `<div style="font-weight: 600; color: #111827; margin-top: 4px;">${name}</div>`;
                    htmlContent += `<div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${title}</div>`;
                    htmlContent += '</div>';
                });

                htmlContent += '</div></div>';
            }

            // Always set innerHTML, even if empty, to ensure display
            memoBodyContent.innerHTML = htmlContent || '<div style="color: #9ca3af;">No content available</div>';

            // Reinitialize icons for attachment links
            if (typeof lucide !== 'undefined') {
                // eslint-disable-next-line no-undef
                lucide.createIcons();
            }

            // Attach click handlers for attachments (opens in modal instead of new tab)
            attachAttachmentHandlers(memo);

            // Ensure memo body is visible
            const memoBody = document.querySelector('.memo-body');
            if (memoBody) {
                memoBody.style.display = 'block';
                memoBody.style.visibility = 'visible';
            }
        } else {
            // eslint-disable-next-line no-console
            console.error('memoBodyContent element not found in DOM');
        }

        // Update navigation buttons and counter
        // Use currentMemoIndex instead of index parameter since displayMemoContent doesn't receive index
        const memoIndex = currentMemoIndex >= 0 ? currentMemoIndex : 0;
        if (prevBtn) {prevBtn.disabled = memoIndex === 0;}
        if (nextBtn) {nextBtn.disabled = memoIndex >= filteredMemos.length - 1;}
        if (memoCounter && filteredMemos.length > 0) {
            memoCounter.textContent = `${memoIndex + 1} of ${filteredMemos.length}`;
        } else if (memoCounter) {
            memoCounter.textContent = '0 of 0';
        }

        // Update star button
        updateStarButton(memo.isStarred);

        // Update acknowledgment UI
        updateAcknowledgmentUI(memo);

        // Hide separate attachments div - attachments are now inline with content (Gmail style)
        // All attachments are displayed inline within memoBodyContent above
        if (attachmentsDiv) {
            attachmentsDiv.innerHTML = '';
            attachmentsDiv.style.display = 'none';
        }

        // Show approve/reject buttons for admin when viewing pending secretary memos
        const memoViewerModal = document.getElementById('memoViewerModal');
        if (memoViewerModal) {
            let footer = memoViewerModal.querySelector('.memo-viewer-footer');
            if (!footer) {
                // Create footer if it doesn't exist
                footer = document.createElement('div');
                footer.className = 'memo-viewer-footer';
                footer.style.cssText = 'padding: 16px 24px; border-top: 1px solid #e5e7eb; display: none; justify-content: flex-end; gap: 12px; align-items: center;';
                // Append footer to modal-content, not memo-content
                const modalContent = memoViewerModal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.appendChild(footer);
                } else {
                    // Fallback: append to memoViewer
                    const memoViewer = memoViewerModal.querySelector('#memoViewer');
                    if (memoViewer) {
                        memoViewer.appendChild(footer);
                    }
                }
            }

            // Clear existing buttons
            footer.innerHTML = '';

            // Check if this is a pending secretary memo that needs admin approval
            const statusStr = (memo.status || '').toLowerCase();
            const isPendingStatus = ['pending_admin', 'pending'].includes(statusStr);
            const isAdminUser = (window.currentUser && (window.currentUser.role === 'admin'));
            const isCalendarEvent = (memo.metadata && memo.metadata.eventType === 'calendar_event') ||
                                   (memo.subject && memo.subject.includes('Calendar Event')) ||
                                   (memo.activityType === 'system_notification' && memo.subject && memo.subject.includes('📅'));

            // Show buttons if: pending status AND admin user AND not calendar event
            if (!isCalendarEvent && isAdminUser && isPendingStatus) {
                footer.style.display = 'flex';
                footer.style.flexDirection = 'row';
                footer.style.gap = '12px';
                footer.style.justifyContent = 'flex-end';
                footer.style.alignItems = 'center';

                const rejectBtn = document.createElement('button');
                rejectBtn.textContent = 'Reject';
                rejectBtn.style.cssText = 'background:#f3f4f6;color:#111827;border:1px solid #e5e7eb;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:500;font-size:14px;transition:all 0.2s;min-width:100px;';
                rejectBtn.addEventListener('mouseenter', () => {
                    rejectBtn.style.background = '#e5e7eb';
                });
                rejectBtn.addEventListener('mouseleave', () => {
                    rejectBtn.style.background = '#f3f4f6';
                });
                rejectBtn.addEventListener('click', async () => {
                    // Show prompt for rejection reason
                    const { value: reason } = await Swal.fire({
                        title: 'Reject Memo',
                        input: 'textarea',
                        inputLabel: 'Rejection Reason (optional)',
                        inputPlaceholder: 'Enter reason for rejection...',
                        inputAttributes: {
                            'aria-label': 'Enter rejection reason'
                        },
                        showCancelButton: true,
                        confirmButtonText: 'Reject',
                        confirmButtonColor: '#ef4444',
                        cancelButtonText: 'Cancel',
                        inputValidator: (value) => {
                            // Reason is optional, so no validation needed
                            return null;
                        }
                    });

                    if (reason !== undefined) {
                        try {
                            const response = await fetch(`/api/log/memos/${memo._id}/reject`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'same-origin',
                                body: JSON.stringify({ reason: reason || '' })
                            });

                            const data = await response.json();
                            if (data.success) {
                                await Swal.fire({
                                    icon: 'success',
                                    title: 'Memo Rejected',
                                    text: data.message || 'Memo has been rejected.'
                                });
                                // Refresh memo list
                                if (typeof fetchMemos === 'function') {
                                    fetchMemos();
                                }
                                // Close modal
                                if (memoViewerModal) {
                                    memoViewerModal.style.display = 'none';
                                }
                            } else {
                                throw new Error(data.message || 'Failed to reject memo');
                            }
                        } catch (error) {
                            console.error('Error rejecting memo:', error);
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: error.message || 'Failed to reject memo'
                            });
                        }
                    }
                });

                const approveBtn = document.createElement('button');
                approveBtn.textContent = 'Approve';
                approveBtn.style.cssText = 'background:#1C89E3;color:#fff;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:500;font-size:14px;transition:all 0.2s;min-width:100px;';
                approveBtn.addEventListener('mouseenter', () => {
                    approveBtn.style.background = '#1570cd';
                });
                approveBtn.addEventListener('mouseleave', () => {
                    approveBtn.style.background = '#1C89E3';
                });
                approveBtn.addEventListener('click', async () => {
                    try {
                        const response = await fetch(`/api/log/memos/${memo._id}/approve`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'same-origin'
                        });

                        const data = await response.json();
                        if (data.success) {
                            await Swal.fire({
                                icon: 'success',
                                title: 'Memo Approved',
                                text: data.message || 'Memo has been approved and sent to recipients.'
                            });
                            // Refresh memo list
                            if (typeof fetchMemos === 'function') {
                                fetchMemos();
                            }
                            // Close modal
                            if (memoViewerModal) {
                                memoViewerModal.style.display = 'none';
                            }
                        } else {
                            throw new Error(data.message || 'Failed to approve memo');
                        }
                    } catch (error) {
                        console.error('Error approving memo:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: error.message || 'Failed to approve memo'
                        });
                    }
                });

                footer.appendChild(rejectBtn);
                footer.appendChild(approveBtn);
            } else {
                // Hide footer if buttons shouldn't be shown
                footer.style.display = 'none';
            }
        }
    }

    // Show memo viewer
    function showMemoViewer() {
        if (emptyState) {emptyState.style.display = 'none';}
        if (memoViewer) {memoViewer.style.display = 'flex';}
    }

    // Show default empty view
    function showDefaultView() {
        if (emptyState) {emptyState.style.display = 'flex';}
        if (memoViewer) {memoViewer.style.display = 'none';}
        currentMemoIndex = -1;
        currentMemoId = null;
        if (downloadBtn) {downloadBtn.disabled = true;}
    }

    // Hide memo viewer
    function hideMemoViewer() {
        showDefaultView();
    }

    // Update star button - icon only, no duplication
    function updateStarButton(isStarred) {
        if (!starBtn) {return;}

        // Clear all existing icons first to prevent duplication
        starBtn.innerHTML = '';

        // Create a single icon element
        const icon = document.createElement('i');
        icon.style.width = '20px';
        icon.style.height = '20px';

        if (isStarred) {
            icon.setAttribute('data-lucide', 'star');
            icon.style.color = '#fbbf24';
            starBtn.style.color = '#fbbf24';
        } else {
            icon.setAttribute('data-lucide', 'bookmark');
            icon.style.color = '#6b7280';
            starBtn.style.color = '#6b7280';
        }

        // Append the single icon
        starBtn.appendChild(icon);

        // Initialize Lucide icons only for this button
        if (typeof lucide !== 'undefined') {
            // eslint-disable-next-line no-undef
            lucide.createIcons();
        }
    }

    // Format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    // Format file size
    function formatFileSize(bytes) {
        if (bytes < 1024) {return bytes + ' B';}
        if (bytes < 1024 * 1024) {return (bytes / 1024).toFixed(1) + ' KB';}
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Update acknowledgment UI based on memo and current user
    function updateAcknowledgmentUI(memo) {
        if (!memo || !window.currentUser) return;

        const currentUserId = window.currentUser._id || window.currentUser.id;
        const isRecipient = memo.recipient && (memo.recipient._id?.toString() === currentUserId.toString() || memo.recipient.toString() === currentUserId.toString());
        const isSender = memo.sender && (memo.sender._id?.toString() === currentUserId.toString() || memo.sender.toString() === currentUserId.toString());

        // Get acknowledgments array (default to empty array)
        const acknowledgments = memo.acknowledgments || [];
        const acknowledgedUserIds = acknowledgments.map(ack => ack.userId?._id?.toString() || ack.userId?.toString()).filter(Boolean);
        const isAcknowledged = isRecipient && acknowledgedUserIds.includes(currentUserId.toString());

        // Show/hide acknowledge button for recipients (but not if user is also the sender)
        if (acknowledgeBtn) {
            if (isRecipient && !isSender && !isAcknowledged) {
                acknowledgeBtn.style.display = 'inline-flex';
            } else {
                acknowledgeBtn.style.display = 'none';
            }
        }

        // Show/hide reminder button and acknowledgment status for senders
        if (reminderBtn) {
            if (isSender) {
                reminderBtn.style.display = 'inline-flex';
            } else {
                reminderBtn.style.display = 'none';
            }
        }

        // Display acknowledgment status for approved memos (for senders or anyone viewing approved memos)
        const isApproved = memo.status && memo.status.toLowerCase() === 'approved';
        if (isApproved || isSender) {
            displayAcknowledgmentStatus(memo);
        } else {
            const statusDiv = document.getElementById('acknowledgmentStatus');
            if (statusDiv) {
                statusDiv.style.display = 'none';
            }
        }
    }

    // Display recipient avatars with acknowledged status inline in the "To:" field
    function displayRecipientAvatarsInline(memo, allRecipients) {
        const avatarsDiv = document.getElementById('recipientAvatarsInline');
        if (!avatarsDiv) return;

        const acknowledgments = memo.acknowledgments || [];
        const acknowledgedUserIds = acknowledgments.map(ack => ack.userId?._id?.toString() || ack.userId?.toString()).filter(Boolean);

        if (allRecipients.length === 0) {
            avatarsDiv.innerHTML = '';
            return;
        }

        let avatarsHTML = '';
        allRecipients.forEach(recipient => {
            const recipientId = recipient._id?.toString() || recipient.toString();
            const isAcknowledged = acknowledgedUserIds.includes(recipientId);
            const recipientName = recipient.firstName && recipient.lastName
                ? `${recipient.firstName} ${recipient.lastName}`.trim()
                : recipient.email || 'Unknown';
            const initials = recipient.firstName && recipient.lastName
                ? (recipient.firstName.charAt(0) + recipient.lastName.charAt(0)).toUpperCase()
                : (recipient.email || '?').charAt(0).toUpperCase();
            const profilePicture = recipient.profilePicture || null;

            const statusClass = isAcknowledged ? 'acknowledged' : 'unacknowledged';
            const statusTitle = isAcknowledged ? `${recipientName} - Acknowledged` : `${recipientName} - Not acknowledged`;

            avatarsHTML += `
                <div class="recipient-avatar-inline ${statusClass}" title="${statusTitle}">
                    ${profilePicture
                        ? `<img src="${profilePicture}" alt="${recipientName}" onerror="this.parentElement.querySelector('.avatar-initials-inline').style.display='flex'; this.style.display='none';" />`
                        : ''
                    }
                    <div class="avatar-initials-inline" style="${profilePicture ? 'display: none;' : 'display: flex;'}">${initials}</div>
                    ${isAcknowledged ? '<div class="avatar-checkmark-inline">✓</div>' : ''}
                </div>
            `;
        });

        avatarsDiv.innerHTML = avatarsHTML;
    }

    // Display acknowledgment status (for senders) - compact version with avatars
    function displayAcknowledgmentStatus(memo) {
        const statusDiv = document.getElementById('acknowledgmentStatus');
        const avatarsDiv = document.getElementById('acknowledgmentAvatars');
        const reminderBtnCompact = document.getElementById('reminderBtnCompact');

        if (!statusDiv || !avatarsDiv) return;

        const acknowledgments = memo.acknowledgments || [];
        const acknowledgedUserIds = acknowledgments.map(ack => ack.userId?._id?.toString() || ack.userId?.toString()).filter(Boolean);

        // Get all recipients
        const allRecipients = [];
        if (memo.recipients && memo.recipients.length > 0) {
            allRecipients.push(...memo.recipients);
        } else if (memo.recipient) {
            allRecipients.push(memo.recipient);
        }

        if (allRecipients.length === 0) {
            statusDiv.style.display = 'none';
            return;
        }

        // Separate acknowledged and unacknowledged recipients
        const acknowledged = [];
        const unacknowledged = [];

        allRecipients.forEach(recipient => {
            const recipientId = recipient._id?.toString() || recipient.toString();
            const ack = acknowledgments.find(a => (a.userId?._id?.toString() || a.userId?.toString()) === recipientId);
            const recipientName = recipient.firstName && recipient.lastName
                ? `${recipient.firstName} ${recipient.lastName}`.trim()
                : recipient.email || 'Unknown';
            const initials = recipient.firstName && recipient.lastName
                ? (recipient.firstName.charAt(0) + recipient.lastName.charAt(0)).toUpperCase()
                : (recipient.email || '?').charAt(0).toUpperCase();

            if (ack) {
                acknowledged.push({
                    name: recipientName,
                    profilePicture: recipient.profilePicture,
                    initials: initials,
                    id: recipientId
                });
            } else {
                unacknowledged.push({
                    name: recipientName,
                    profilePicture: recipient.profilePicture,
                    initials: initials,
                    id: recipientId
                });
            }
        });

        // Render avatars - acknowledged (green border) and unacknowledged (red border)
        let avatarsHTML = '';

        // Show acknowledged avatars first (with green checkmark)
        acknowledged.forEach(recip => {
            avatarsHTML += `
                <div class="acknowledgment-avatar acknowledged" title="${recip.name} - Acknowledged">
                    ${recip.profilePicture
                        ? `<img src="${recip.profilePicture}" alt="${recip.name}" />`
                        : `<div class="avatar-initials">${recip.initials}</div>`
                    }
                    <div class="avatar-checkmark">✓</div>
                </div>
            `;
        });

        // Show unacknowledged avatars (with red border)
        unacknowledged.forEach(recip => {
            avatarsHTML += `
                <div class="acknowledgment-avatar unacknowledged" title="${recip.name} - Not acknowledged">
                    ${recip.profilePicture
                        ? `<img src="${recip.profilePicture}" alt="${recip.name}" />`
                        : `<div class="avatar-initials">${recip.initials}</div>`
                    }
                </div>
            `;
        });

        avatarsDiv.innerHTML = avatarsHTML || '<span style="color: #9ca3af; font-size: 14px;">No recipients</span>';

        // Show/hide reminder button based on unacknowledged count (only for senders)
        if (reminderBtnCompact) {
            const currentUserId = window.currentUser?._id || window.currentUser?.id;
            const isSender = memo.sender && (memo.sender._id?.toString() === currentUserId?.toString() || memo.sender.toString() === currentUserId?.toString());
            if (isSender && unacknowledged.length > 0) {
                reminderBtnCompact.style.display = 'inline-flex';
            } else {
                reminderBtnCompact.style.display = 'none';
            }
        }

        // Show status div
        statusDiv.style.display = 'flex';

        // Initialize Lucide icons for reminder button
        if (typeof lucide !== 'undefined') {
            setTimeout(() => {
                lucide.createIcons();
            }, 100);
        }
    }

    // Handle acknowledge button click
    if (acknowledgeBtn) {
        acknowledgeBtn.addEventListener('click', async () => {
            if (!currentMemoId) return;

            try {
                acknowledgeBtn.disabled = true;
                const response = await fetch(`/api/log/memos/${currentMemoId}/acknowledge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                });

                const data = await response.json();
                if (data && data.success) {
                    // Update current memo with new acknowledgment
                    if (data.memo) {
                        const memoIndex = filteredMemos.findIndex(m => m._id === currentMemoId);
                        if (memoIndex >= 0) {
                            filteredMemos[memoIndex] = data.memo;
                        }
                        displayMemoContent(data.memo);
                    }

                    // Show success notification
                    if (typeof showNotification === 'function') {
                        showNotification('Memo acknowledged successfully', 'success');
                    } else if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Acknowledged',
                            text: 'Memo acknowledged successfully',
                            timer: 2000,
                            showConfirmButton: false,
                            toast: true,
                            position: 'top-end'
                        });
                    }
                } else {
                    throw new Error(data?.message || 'Failed to acknowledge memo');
                }
            } catch (error) {
                console.error('Error acknowledging memo:', error);
                if (typeof showNotification === 'function') {
                    showNotification(error.message || 'Failed to acknowledge memo', 'error');
                } else if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'Failed to acknowledge memo',
                        timer: 3000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            } finally {
                acknowledgeBtn.disabled = false;
            }
        });
    }

    // Handle reminder button click (both header and compact versions)
    const handleReminderClick = async () => {
            if (!currentMemoId) return;

            const reminderBtnCompactEl = document.getElementById('reminderBtnCompact');
            try {
                if (reminderBtn) reminderBtn.disabled = true;
                if (reminderBtnCompactEl) reminderBtnCompactEl.disabled = true;
                const response = await fetch(`/api/log/memos/${currentMemoId}/reminder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                });

                const data = await response.json();
                if (data && data.success) {
                    // Show success notification
                    if (typeof showNotification === 'function') {
                        showNotification(data.message || `Reminder sent to ${data.remindersSent || 0} recipient(s)`, 'success');
                    } else if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Reminder Sent',
                            text: data.message || `Reminder sent to ${data.remindersSent || 0} recipient(s)`,
                            timer: 3000,
                            showConfirmButton: false,
                            toast: true,
                            position: 'top-end'
                        });
                    }

                    // Refresh memo to update acknowledgment status
                    if (currentMemoId) {
                        try {
                            const memoResponse = await fetch(`/api/log/memos/${currentMemoId}`);
                            const memoData = await memoResponse.json();
                            if (memoData && memoData.success && memoData.memo) {
                                const memoIndex = filteredMemos.findIndex(m => m._id === currentMemoId);
                                if (memoIndex >= 0) {
                                    filteredMemos[memoIndex] = memoData.memo;
                                }
                                displayMemoContent(memoData.memo);
                            }
                        } catch (e) {
                            console.error('Error refreshing memo:', e);
                        }
                    }
                } else {
                    throw new Error(data?.message || 'Failed to send reminder');
                }
            } catch (error) {
                console.error('Error sending reminder:', error);
                if (typeof showNotification === 'function') {
                    showNotification(error.message || 'Failed to send reminder', 'error');
                } else if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'Failed to send reminder',
                        timer: 3000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }
            } finally {
                if (reminderBtn) reminderBtn.disabled = false;
                const reminderBtnCompactEl = document.getElementById('reminderBtnCompact');
                if (reminderBtnCompactEl) reminderBtnCompactEl.disabled = false;
            }
        };

    // Attach to both reminder buttons
    if (reminderBtn) {
        reminderBtn.addEventListener('click', handleReminderClick);
    }

    const reminderBtnCompactEl = document.getElementById('reminderBtnCompact');
    if (reminderBtnCompactEl) {
        reminderBtnCompactEl.addEventListener('click', handleReminderClick);
    }

    // Modal helpers
    function openModal(modal) {
        modal.style.display = 'block';
    }

    function closeModal(modal) {
        modal.style.display = 'none';
        // Reset Add Signature form if closing that modal
        if (modal.id === 'addSignatureModal'){
            const form = document.getElementById('addSignatureForm');
            if (form) {form.reset();}
        }
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = btn.getAttribute('data-modal');
            if (modalId){
                const modal = document.getElementById(modalId);
                if (modal) {closeModal(modal);}
            } else {
                const modal = e.target.closest('.modal');
                if (modal) {closeModal(modal);}
            }
        });
    });

    // Close Add Signature modal when clicking outside
    const addSignatureModal = document.getElementById('addSignatureModal');
    if (addSignatureModal){
        addSignatureModal.addEventListener('click', (e)=>{
            if (e.target === addSignatureModal){
                closeModal(addSignatureModal);
            }
        });
    }


    // Show inline error message below recipient input field
    function showRecipientDomainError(message) {
        // Remove existing error message if any
        const existingError = document.getElementById('recipient-domain-error');
        if (existingError) {
            existingError.remove();
        }

        // Find the recipient input container
        const recipientContainer = document.querySelector('.recipient-input-container');
        if (!recipientContainer) {
            return;
        }

        // Create error message element
        const errorElement = document.createElement('div');
        errorElement.id = 'recipient-domain-error';
        errorElement.className = 'recipient-domain-error';
        errorElement.textContent = message;

        // Add styles if not already added
        if (!document.getElementById('recipient-domain-error-styles')) {
            const style = document.createElement('style');
            style.id = 'recipient-domain-error-styles';
            style.textContent = `
                .recipient-domain-error {
                    color: #ef4444;
                    font-size: 13px;
                    margin-top: 6px;
                    padding-left: 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    animation: slideDown 0.2s ease;
                }
                .recipient-domain-error::before {
                    content: "⚠";
                    font-size: 16px;
                }
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes slideUp {
                    from {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Insert error message after the recipient input wrapper
        const recipientWrapper = recipientContainer.querySelector('.recipient-input-wrapper');
        if (recipientWrapper && recipientWrapper.parentNode) {
            recipientWrapper.parentNode.insertBefore(errorElement, recipientWrapper.nextSibling);
        }

        // Auto-remove error after user starts typing or after 5 seconds
        const removeError = () => {
            if (errorElement.parentNode) {
                errorElement.style.animation = 'slideUp 0.2s ease';
                setTimeout(() => errorElement.remove(), 200);
            }
        };

        if (recipientsInput) {
            const inputHandler = () => {
                removeError();
                recipientsInput.removeEventListener('input', inputHandler);
            };
            recipientsInput.addEventListener('input', inputHandler);
        }

        setTimeout(removeError, 5000);
    }

    // Error Modal - styled like the image with red error icon
    function showErrorModal(message) {
        // Remove existing error modals
        const existing = document.querySelectorAll('.error-modal-overlay');
        existing.forEach(m => m.remove());

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'error-modal-overlay';
        overlay.innerHTML = `
            <div class="error-modal">
                <div class="error-icon-container">
                    <div class="error-icon">
                        <span class="error-x">×</span>
                    </div>
                </div>
                <h2 class="error-title">Sorry!</h2>
                <p class="error-message">${message}</p>
                <button class="error-ok-btn">OK</button>
            </div>
        `;

        // Add styles if not already added
        if (!document.getElementById('error-modal-styles')) {
            const style = document.createElement('style');
            style.id = 'error-modal-styles';
            style.textContent = `
                .error-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100010;
                    animation: fadeIn 0.2s ease;
                    overflow: hidden;
                }
                .error-modal {
                    background: white;
                    border-radius: 12px;
                    padding: 40px 32px 32px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                    text-align: center;
                    animation: slideUp 0.3s ease;
                    overflow: hidden;
                    position: relative;
                }
                .error-icon-container {
                    margin-bottom: 20px;
                    overflow: hidden;
                    height: 84px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .error-icon {
                    width: 64px;
                    height: 64px;
                    border-radius: 50%;
                    background-color: #ef4444;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                    overflow: hidden;
                    position: relative;
                    flex-shrink: 0;
                }
                .error-x {
                    color: white;
                    font-size: 40px;
                    font-weight: bold;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    height: 100%;
                    user-select: none;
                    -webkit-user-select: none;
                }
                .error-title {
                    font-size: 24px;
                    font-weight: 600;
                    color: #374151;
                    margin: 0 0 16px 0;
                }
                .error-message {
                    font-size: 16px;
                    color: #374151;
                    margin: 0 0 24px 0;
                    line-height: 1.5;
                }
                .error-ok-btn {
                    background-color: #ef4444;
                    color: white;
                    border: none;
                    padding: 12px 32px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    min-width: 100px;
                }
                .error-ok-btn:hover {
                    background-color: #dc2626;
                }
                .error-ok-btn:active {
                    background-color: #b91c1c;
                }
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                @keyframes slideUp {
                    from {
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Add to body
        document.body.appendChild(overlay);

        // Close handlers
        const closeModal = () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
        };

        overlay.querySelector('.error-ok-btn').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // Add fadeOut animation if not exists
        if (!document.getElementById('error-modal-fadeout')) {
            const fadeOutStyle = document.createElement('style');
            fadeOutStyle.id = 'error-modal-fadeout';
            fadeOutStyle.textContent = `
                @keyframes fadeOut {
                    from {
                        opacity: 1;
                    }
                    to {
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(fadeOutStyle);
        }
    }

    // Notification helper with toast implementation
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.toast-notification');
        existing.forEach(n => n.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `toast-notification toast-${type}`;
        notification.innerHTML = `
            <div class="toast-content">
                <span class="toast-message">${message}</span>
                <button class="toast-close">&times;</button>
            </div>
        `;

        // Add styles if not already added
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    min-width: 300px;
                    max-width: 500px;
                    padding: 16px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10002;
                    animation: slideInRight 0.3s ease;
                    display: flex;
                    align-items: center;
                }
                .toast-success {
                    background: #10b981;
                    color: white;
                }
                .toast-error {
                    background: #ef4444;
                    color: white;
                }
                .toast-info {
                    background: #3b82f6;
                    color: white;
                }
                .toast-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    gap: 12px;
                }
                .toast-message {
                    flex: 1;
                    font-size: 14px;
                    font-weight: 500;
                }
                .toast-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.8;
                }
                .toast-close:hover {
                    opacity: 1;
                }
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Add to body
        document.body.appendChild(notification);

        // Close button handler
        notification.querySelector('.toast-close').addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    // Undo Delete function
    async function undoDelete(originalIndex, memo) {
        try {
            // Restore the memo by calling the restore endpoint
            const response = await fetch(`/api/log/memos/${memo._id}/restore`, {
                method: 'PUT'
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Memo restored', 'success');
                // Refresh the list
                fetchMemos();
            }
        } catch (error) {
            console.error('Error restoring memo:', error);
            showNotification('Error restoring memo', 'error');
        }
    }

    // Show undo notification with timeout
    function showUndoNotification(message, undoCallback) {
        // Remove existing notification if any
        const existingNotification = document.getElementById('undo-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification
        const notification = document.createElement('div');
        notification.id = 'undo-notification';
        notification.innerHTML = `
            <span>${message}</span>
            <button id="undo-btn" class="undo-btn">Undo</button>
        `;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #1f2937;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 16px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;

        document.body.appendChild(notification);

        // Add undo button handler
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => {
                undoCallback();
                notification.remove();
            });
        }

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    // Add CSS animations if not already present
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            #undo-notification {
                animation: slideUp 0.3s ease;
            }
            @keyframes slideUp {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
            .undo-btn {
                background: white;
                color: #1f2937;
                border: none;
                padding: 6px 16px;
                border-radius: 4px;
                font-weight: 600;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            }
            .undo-btn:hover {
                background: #f3f4f6;
            }
        `;
        document.head.appendChild(style);
    }
});

// Schedule modal functions (global scope for onclick handlers)
function saveSchedule() {
    try {
        const scheduleStartDate = document.getElementById('scheduleStartDate');
        const scheduleStartTime = document.getElementById('scheduleStartTime');
        const scheduleEndDate = document.getElementById('scheduleEndDate');
        const scheduleEndTime = document.getElementById('scheduleEndTime');
        const scheduleAllDay = document.getElementById('scheduleAllDay');
        const scheduleModal = document.getElementById('scheduleModal');
        const memoDate = document.getElementById('memoDate');
        const memoTime = document.getElementById('memoTime');
        const allDayEvent = document.getElementById('allDayEvent');
        const calendarBtn = document.getElementById('calendarBtn');
        const calendarBtnText = document.getElementById('calendarBtnText');

        // Legacy fields for backward compatibility
        const scheduleDate = document.getElementById('scheduleDate');
        const scheduleTime = document.getElementById('scheduleTime');

        if (!scheduleStartDate) {
            console.error('scheduleStartDate element not found');
            return;
        }

        if (scheduleStartDate.value) {
            // Save Start date/time to memoDate/memoTime (for backward compatibility)
            if (memoDate) {
                memoDate.value = scheduleStartDate.value;
            }

            // Save Start time (only if not all-day)
            if (memoTime) {
                if (scheduleAllDay && scheduleAllDay.checked) {
                    memoTime.value = '';
                } else if (scheduleStartTime && scheduleStartTime.value) {
                    memoTime.value = scheduleStartTime.value;
                } else {
                    memoTime.value = '';
                }
            }

            // Save all-day flag
            if (allDayEvent) {
                allDayEvent.value = (scheduleAllDay && scheduleAllDay.checked) ? 'true' : 'false';
            }

            // Store End date/time in hidden fields (will be sent to backend)
            // Create or update hidden fields for End date/time
            let endDateField = document.getElementById('memoEndDate');
            let endTimeField = document.getElementById('memoEndTime');
            if (!endDateField) {
                endDateField = document.createElement('input');
                endDateField.type = 'hidden';
                endDateField.id = 'memoEndDate';
                endDateField.name = 'memoEndDate';
                const composeForm = document.getElementById('composeForm');
                if (composeForm) {
                    composeForm.appendChild(endDateField);
                }
            }
            if (!endTimeField) {
                endTimeField = document.createElement('input');
                endTimeField.type = 'hidden';
                endTimeField.id = 'memoEndTime';
                endTimeField.name = 'memoEndTime';
                const composeForm = document.getElementById('composeForm');
                if (composeForm) {
                    composeForm.appendChild(endTimeField);
                }
            }

            if (scheduleEndDate && scheduleEndDate.value) {
                endDateField.value = scheduleEndDate.value;
            } else if (scheduleStartDate && scheduleStartDate.value) {
                // Default End date to Start date if not set
                endDateField.value = scheduleStartDate.value;
            }

            if (scheduleEndTime && scheduleEndTime.value && !scheduleAllDay.checked) {
                endTimeField.value = scheduleEndTime.value;
            } else {
                endTimeField.value = '';
            }

            // Update button appearance
            if (calendarBtn) {
                calendarBtn.classList.add('scheduled');
                if (calendarBtnText) {
                    const date = new Date(scheduleStartDate.value + 'T00:00:00');
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    if (scheduleAllDay && scheduleAllDay.checked) {
                        calendarBtnText.textContent = dateStr;
                    } else if (scheduleStartTime && scheduleStartTime.value) {
                        // Format time (HH:MM to HH:MM AM/PM)
                        const [hours, minutes] = scheduleStartTime.value.split(':');
                        const hour24 = parseInt(hours, 10);
                        const hour12 = hour24 === 0 ? 12 : (hour24 > 12 ? hour24 - 12 : hour24);
                        const ampm = hour24 >= 12 ? 'PM' : 'AM';
                        const timeStr = `${hour12}:${minutes} ${ampm}`;
                        calendarBtnText.textContent = `${dateStr} ${timeStr}`;
                    } else {
                        calendarBtnText.textContent = dateStr;
                    }
                }
            }
        } else {
            // Clear if no date
            clearSchedule();
        }

        // Close modal
        if (scheduleModal) {
            scheduleModal.style.display = 'none';
        }

        // Reinitialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (error) {
        console.error('Error in saveSchedule:', error);
    }
}

function clearSchedule() {
    const memoDate = document.getElementById('memoDate');
    const memoTime = document.getElementById('memoTime');
    const allDayEvent = document.getElementById('allDayEvent');
    const scheduleStartDate = document.getElementById('scheduleStartDate');
    const scheduleStartTime = document.getElementById('scheduleStartTime');
    const scheduleEndDate = document.getElementById('scheduleEndDate');
    const scheduleEndTime = document.getElementById('scheduleEndTime');
    const scheduleAllDay = document.getElementById('scheduleAllDay');
    const calendarBtn = document.getElementById('calendarBtn');
    const calendarBtnText = document.getElementById('calendarBtnText');

    // Legacy fields
    const scheduleDate = document.getElementById('scheduleDate');
    const scheduleTime = document.getElementById('scheduleTime');

    // End date/time hidden fields
    const endDateField = document.getElementById('memoEndDate');
    const endTimeField = document.getElementById('memoEndTime');

    if (memoDate) {
        memoDate.value = '';
    }
    if (memoTime) {
        memoTime.value = '';
    }
    if (allDayEvent) {
        allDayEvent.value = 'false';
    }

    if (scheduleStartDate) {
        scheduleStartDate.value = '';
    }
    if (scheduleStartTime) {
        scheduleStartTime.value = '';
    }
    if (scheduleEndDate) {
        scheduleEndDate.value = '';
    }
    if (scheduleEndTime) {
        scheduleEndTime.value = '';
    }
    if (scheduleAllDay) {
        scheduleAllDay.checked = false;
    }
    if (scheduleStartTime) {
        scheduleStartTime.disabled = false;
    }
    if (scheduleEndTime) {
        scheduleEndTime.disabled = false;
    }

    // Legacy fields
    if (scheduleDate) {
        scheduleDate.value = '';
    }
    if (scheduleTime) {
        scheduleTime.value = '';
    }
    if (scheduleTime) {
        scheduleTime.disabled = false;
    }

    // Clear End date/time hidden fields
    if (endDateField) {
        endDateField.value = '';
    }
    if (endTimeField) {
        endTimeField.value = '';
    }

    // Reset button appearance
    if (calendarBtn) {
        calendarBtn.classList.remove('scheduled');
        if (calendarBtnText) {
            calendarBtnText.textContent = 'Schedule';
        }
    }
}

