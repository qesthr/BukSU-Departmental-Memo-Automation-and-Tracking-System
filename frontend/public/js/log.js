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

    function attachTemplateHandlers(modal){
        const dropdownBtn = modal.querySelector('#templateDropdownBtn');
        const dropdownMenu = modal.querySelector('#templateDropdownMenu');
        const container = modal.querySelector('#templateSignaturesContainer');
        const addBtn = modal.querySelector('#addSignatureBtn');
        if (!dropdownBtn || !dropdownMenu || !container) {return;}

        const dropdown = dropdownBtn.closest('.custom-dropdown');
        if (!dropdown) {return;}

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

        // Populate dropdown when modal opens (async)
        populateTemplateDropdown();

        // Toggle dropdown
        dropdownBtn.addEventListener('click', (e)=>{
            e.preventDefault();
            e.stopPropagation();
            // Close department dropdown if open
            const deptBtn = modal.querySelector('#deptDropdownBtn');
            const deptDropdown = deptBtn ? deptBtn.closest('.custom-dropdown') : null;
            if (deptDropdown) { deptDropdown.classList.remove('open'); }
            dropdown.classList.toggle('open');
        });

        // Close on outside click
        document.addEventListener('click', (e)=>{
            if (!dropdown.contains(e.target)){
                dropdown.classList.remove('open');
            }
        });

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
            previewBtn.addEventListener('click', async ()=>{
                try{
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
                    const data = await res.json().catch(()=>({}));
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
                            alert('Preview container missing');
                        }
                    } else { alert(data.message || 'Preview unavailable'); }
                }catch(err){ alert('Preview failed'); }
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
                alert('Please fill all fields including signature image');
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
                    alert('Signature added successfully!');
                } else {
                    alert(data.message || 'Failed to add signature');
                }
            }catch(err){
                alert('Error adding signature');
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

        switch(action) {
            case 'all':
                // Show all memos and select all (could be used for bulk actions in the future)
                memoItems.forEach(item => {
                    item.style.display = '';
                    item.classList.add('selected');
                });
                break;
            case 'none':
                // Show all memos and deselect all
                memoItems.forEach(item => {
                    item.style.display = '';
                    item.classList.remove('selected');
                });
                break;
            case 'read':
                // Filter to show only read memos (if read status is tracked)
                // This would need to be implemented based on your memo model
                memoItems.forEach(item => {
                    item.style.display = '';
                });
                break;
            case 'unread':
                // Filter to show only unread memos
                memoItems.forEach(item => {
                    item.style.display = '';
                });
                break;
            case 'starred':
                // Filter to show only starred memos
                memoItems.forEach(item => {
                    const memoId = item.dataset.id;
                    const memo = filteredMemos.find(m => m._id === memoId);
                    if (memo && memo.isStarred) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
                break;
            case 'unstarred':
                // Filter to show only unstarred memos
                memoItems.forEach(item => {
                    const memoId = item.dataset.id;
                    const memo = filteredMemos.find(m => m._id === memoId);
                    if (memo && !memo.isStarred) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
                break;
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
    fetch('/api/users/emails')
        .then(res => res.json())
        .then(data => {
            registeredUsers = Array.isArray(data) ? data : [];
            // Create email lookup map for quick validation
            window.registeredUsersMap = new Map(registeredUsers.map(u => [u.email.toLowerCase(), u]));
        })
        .catch(err => {
            console.error('Error loading registered users:', err);
        });

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

    if (recipientsInput && recipientChipsContainer) {
        recipientsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const email = recipientsInput.value.trim().toLowerCase();

                if (!email) {return;}

                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    showNotification('Please enter a valid email address.', 'error');
                    return;
                }

                // Validate against registered users
                const user = window.registeredUsersMap?.get(email);
                if (!user) {
                    showNotification(`Email "${email}" is not registered.`, 'error');
                    return;
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
            }
        });

        // Handle paste events for comma-separated emails
        recipientsInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                const pastedText = recipientsInput.value.trim();
                const emails = pastedText.split(/[,\s]+/).filter(e => e.trim());

                if (emails.length > 1) {
                    recipientsInput.value = '';
                    emails.forEach(email => {
                        const user = window.registeredUsersMap?.get(email.toLowerCase());
                        if (user && !recipientData.find(u => u.email.toLowerCase() === email.toLowerCase())) {
                            recipientData.push(user);
                        }
                    });
                    renderRecipientChips();
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

        const dropdownBtn = composeModal.querySelector('#deptDropdownBtn');
        const dropdownMenu = composeModal.querySelector('#deptDropdownMenu');
        const selectAll = composeModal.querySelector('#selectAllDepts');
        let deptOptions = composeModal.querySelectorAll('.dept-option');

        if (!dropdownBtn || !dropdownMenu) {
            return;
        }

        // Remove any existing click handlers to prevent duplicates
        const newBtn = dropdownBtn.cloneNode(true);
        dropdownBtn.parentNode.replaceChild(newBtn, dropdownBtn);
        const freshBtn = composeModal.querySelector('#deptDropdownBtn');
        const deptDropdown = freshBtn.closest('.custom-dropdown');

        // Toggle dropdown on button click
        freshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Close other open dropdowns inside compose modal (e.g., template)
            composeModal.querySelectorAll('.custom-dropdown.open').forEach(dd => {
                if (dd !== deptDropdown) { dd.classList.remove('open'); }
            });
            if (deptDropdown) {
                deptDropdown.classList.toggle('open');
            }
        });

        // Ensure clicks on placeholder don't interfere
        const placeholder = freshBtn.querySelector('.dept-placeholder');
        if (placeholder) {
            placeholder.style.pointerEvents = 'none';
        }

        // Close this dropdown when clicking outside
        const handleOutsideClick = (e) => {
            if (deptDropdown && !deptDropdown.contains(e.target)) {
                deptDropdown.classList.remove('open');
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
    function initSecretaryDeptCheckbox(composeModal) {
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

    // Archive button
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
                // Show undo notification
                showUndoNotification('Memo archived', () => {
                    // Undo function - unarchive the memo (move back to sent)
                    undoArchive(archivedMemoIndex, memoToArchive);
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
                showNotification('Archive undone', 'success');
                renderMemoList();
                fetchMemos();
            }
        } catch (e) {
            console.error('Undo archive failed:', e);
            showNotification('Failed to undo archive', 'error');
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
            let displayUser, displayLabel, subjectPrefix;

            if (isSentFolder) {
                // Sent folder: show recipient (who we sent it to)
                displayUser = memo.recipient;
                displayLabel = 'To';
                subjectPrefix = 'Sent: ';
            } else {
                // Inbox/Received: show sender (who sent it to us)
                displayUser = memo.sender;
                displayLabel = 'From';
                subjectPrefix = '';
            }

            const displayName = displayUser ? `${displayUser.firstName || ''} ${displayUser.lastName || ''}`.trim() : 'Unknown';
            const displayEmail = displayUser?.email || 'N/A';
            const avatarSrc = displayUser?.profilePicture || '/images/memofy-logo.png';
            const subject = subjectPrefix + (memo.subject || '(No subject)');
            const contentPreview = memo.content ? `- ${memo.content.substring(0, 50)}${memo.content.length > 50 ? '...' : ''}` : '- (No content)';

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
                 data-index="${index}">
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
                <div class="memo-subject">${subject}</div>
                <div class="memo-preview">${contentPreview}</div>
                <div class="memo-date">${formatDate(memo.createdAt)}</div>
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
                if (e.target.type === 'checkbox') {return;}
                const index = parseInt(item.dataset.index);
                selectMemo(index);
            });
        });
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
        if (memo._id && (!memo.signatures || memo.signatures.length === 0)) {
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
            const senderName = memo.sender
                ? `${memo.sender.firstName || ''} ${memo.sender.lastName || ''}`.trim()
                : 'Unknown Sender';
            const senderEmail = memo.sender?.email || '';
            memoDetailFrom.textContent = senderEmail ? `${senderName} (${senderEmail})` : senderName;
        }

        if (memoDetailTo) {
            const recipientName = memo.recipient
                ? `${memo.recipient.firstName || ''} ${memo.recipient.lastName || ''}`.trim()
                : 'Unknown Recipient';
            const recipientEmail = memo.recipient?.email || '';
            memoDetailTo.textContent = recipientEmail ? `${recipientName} (${recipientEmail})` : recipientName;
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

        // Update navigation buttons
        if (prevBtn) {prevBtn.disabled = index === 0;}
        if (nextBtn) {nextBtn.disabled = index === filteredMemos.length - 1;}
        if (memoCounter) {memoCounter.textContent = `${index + 1} of ${filteredMemos.length}`;}

        // Update star button
        updateStarButton(memo.isStarred);

        // Hide separate attachments div - attachments are now inline with content (Gmail style)
        // All attachments are displayed inline within memoBodyContent above
        if (attachmentsDiv) {
            attachmentsDiv.innerHTML = '';
            attachmentsDiv.style.display = 'none';
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


