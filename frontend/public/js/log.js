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
    const deleteBtn = document.getElementById('deleteBtn');
    const memoCounter = document.getElementById('memoCounter');
    const refreshBtn = document.getElementById('refreshBtn');
    const selectAllMemos = document.getElementById('selectAllMemos');
    const deptFilterDropdown = document.getElementById('deptFilterDropdown');
    const globalSearchInput = document.getElementById('globalSearchInput');

    let currentFolder = 'inbox';
    let currentDeptFilter = 'all';
    let currentSearchTerm = '';
    let memos = [];
    let filteredMemos = [];
    let currentMemoIndex = -1;
    let currentMemoId = null;

    // Initialize
    fetchMemos();
    loadDepartments();

    // Compose button
    if (composeBtn && composeModal) {
        composeBtn.addEventListener('click', () => {
            openModal(composeModal);
            // Reinitialize Lucide icons
            if (typeof lucide !== 'undefined') {
                // eslint-disable-next-line no-undef
                lucide.createIcons();
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

    // Search functionality
    if (globalSearchInput) {
        globalSearchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            applyFilters();
        });
    }

    // Refresh button
    refreshBtn.addEventListener('click', () => {
        fetchMemos();
        showNotification('Refreshing...', 'success');
    });

    // Select all checkbox
    selectAllMemos.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.memo-item-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
    });

    // Simple textarea for content - no rich text editor
    const contentTextarea = document.getElementById('content');
    const insertImageBtn = document.getElementById('insertImageBtn');
    const attachFileBtn = document.getElementById('attachFileBtn');
    const imageUpload = document.getElementById('imageUpload');
    const fileUpload = document.getElementById('fileUpload');
    const attachmentsPreview = document.getElementById('attachmentsPreview');
    const uploadStatus = document.getElementById('uploadStatus');
    const uploadText = uploadStatus ? uploadStatus.querySelector('.upload-text') : null;
    const sendMemoBtn = document.getElementById('sendMemoBtn');

    // Store uploaded attachments (URLs/filenames)
    const uploadedAttachments = [];

    // Track upload state
    let activeUploads = 0;

    // File upload handler
    if (attachFileBtn && fileUpload) {
        attachFileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileUpload.click();
        });

        fileUpload.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) {return;}

            files.forEach(file => {
                // Validate file size
                if (file.size > 10 * 1024 * 1024) {
                    showNotification(`File "${file.name}" exceeds 10MB limit`, 'error');
                    return;
                }
                // Validate file type
                const allowedTypes = [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/csv',
                    'application/vnd.ms-powerpoint',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                ];
                if (!allowedTypes.includes(file.type)) {
                    showNotification(`File type "${file.type}" not supported. Please use PDF, Word, Excel, PowerPoint, or CSV files.`, 'error');
                    return;
                }
                // Upload and add to attachments list (async)
                handleFileUpload(file).catch(err => {
                    // eslint-disable-next-line no-console
                    console.error('File upload error:', err);
                });
            });
            e.target.value = ''; // Reset input
        });
    }

    // Image upload handler
    if (insertImageBtn && imageUpload) {
        insertImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            imageUpload.click();
        });

        imageUpload.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) {return;}

            files.forEach(file => {
                // Validate file size
                if (file.size > 10 * 1024 * 1024) {
                    showNotification(`Image "${file.name}" exceeds 10MB limit`, 'error');
                    return;
                }
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    showNotification(`"${file.name}" is not a valid image file`, 'error');
                    return;
                }
                // Upload and add to attachments list (async)
                handleImageUpload(file).catch(err => {
                    // eslint-disable-next-line no-console
                    console.error('Image upload error:', err);
                });
            });
            e.target.value = ''; // Reset input
        });
    }

    // Handle file upload - upload and add to attachments list
    async function handleFileUpload(file) {
        // Increment active uploads and show status
        activeUploads++;
        updateUploadStatus();
        disableSendButton();

        // Upload file to server
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/log/upload-file', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.url) {
                throw new Error(data.message || 'Upload failed');
            }

            // Add to uploaded attachments array
            uploadedAttachments.push({
                url: data.url,
                filename: data.filename,
                type: 'file'
            });

            // Add preview item
            addAttachmentPreview({
                url: data.url,
                filename: data.filename,
                type: 'file'
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error uploading file:', error);
            showNotification(`Failed to upload "${file.name}": ${error.message}`, 'error');
        } finally {
            // Decrement active uploads and update status
            activeUploads = Math.max(0, activeUploads - 1);
            updateUploadStatus();
            if (activeUploads === 0) {
                enableSendButton();
            }
        }
    }

    // Handle image upload - upload and add to attachments list
    async function handleImageUpload(file) {
        // Validate image file
        if (!file.type.startsWith('image/')) {
            showNotification(`"${file.name}" is not a valid image file`, 'error');
            return;
        }

        // Increment active uploads and show status
        activeUploads++;
        updateUploadStatus();
        disableSendButton();

        // Upload image to server
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/api/log/upload-image', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.url) {
                throw new Error(data.message || 'Upload failed');
            }

            // Add to uploaded attachments array
            uploadedAttachments.push({
                url: data.url,
                filename: data.filename,
                type: 'image'
            });

            // Add preview item with thumbnail
            addAttachmentPreview({
                url: data.url,
                filename: data.filename,
                type: 'image'
            });
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Error uploading image:', error);
            showNotification(`Failed to upload "${file.name}": ${error.message}`, 'error');
        } finally {
            // Decrement active uploads and update status
            activeUploads = Math.max(0, activeUploads - 1);
            updateUploadStatus();
            if (activeUploads === 0) {
                enableSendButton();
            }
        }
    }

    // Update upload status indicator
    function updateUploadStatus() {
        if (!uploadStatus) {return;}

        if (activeUploads > 0) {
            uploadStatus.classList.add('show');
            if (uploadText) {
                uploadText.textContent = 'Uploading…';
            }
        } else {
            uploadStatus.classList.remove('show');
            if (uploadText) {
                uploadText.textContent = '';
            }
        }
    }

    // Disable send button during uploads
    function disableSendButton() {
        if (sendMemoBtn) {
            sendMemoBtn.disabled = true;
            sendMemoBtn.style.opacity = '0.6';
            sendMemoBtn.style.cursor = 'not-allowed';
        }
    }

    // Enable send button when uploads complete
    function enableSendButton() {
        if (sendMemoBtn) {
            sendMemoBtn.disabled = false;
            sendMemoBtn.style.opacity = '1';
            sendMemoBtn.style.cursor = 'pointer';
        }
    }

    // Add attachment preview item
    function addAttachmentPreview(attachment) {
        if (!attachmentsPreview) {return;}

        const previewItem = document.createElement('div');
        previewItem.className = 'attachment-preview-item';
        previewItem.dataset.url = attachment.url;

        const isImage = attachment.type === 'image';
        const iconHtml = isImage
            ? `<img src="${attachment.url}" alt="${attachment.filename}" class="preview-icon" onerror="this.onerror=null; this.className='preview-icon file-icon'; this.textContent='🖼';" />`
            : `<div class="preview-icon file-icon">📎</div>`;

        previewItem.innerHTML = `
            <div class="preview-content">
                ${iconHtml}
                <span class="preview-filename">${attachment.filename}</span>
            </div>
            <button type="button" class="remove-preview" data-url="${attachment.url}" title="Remove">✕</button>
        `;

        // Add remove handler
        const removeBtn = previewItem.querySelector('.remove-preview');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                removeAttachment(attachment.url);
                previewItem.remove();
                updateAttachmentsPreviewVisibility();
            });
        }

        attachmentsPreview.appendChild(previewItem);
        attachmentsPreview.style.display = 'flex';
    }

    // Update attachments preview visibility
    function updateAttachmentsPreviewVisibility() {
        if (!attachmentsPreview) {return;}

        if (attachmentsPreview.children.length === 0) {
            attachmentsPreview.style.display = 'none';
        }
    }

    // Remove attachment from list
    function removeAttachment(url) {
        const index = uploadedAttachments.findIndex(att => att.url === url);
        if (index > -1) {
            uploadedAttachments.splice(index, 1);
        }

        // Remove preview item if exists
        const previewItem = attachmentsPreview ? attachmentsPreview.querySelector(`[data-url="${url}"]`) : null;
        if (previewItem) {
            previewItem.remove();
            updateAttachmentsPreviewVisibility();
        }
    }


    // Compose form
    if (composeForm) {
        composeForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validation
            const recipientEmail = document.getElementById('recipientEmail').value.trim();
            const selectedDepartments = Array.from(document.querySelectorAll('.dept-option:checked'))
                .map(cb => cb.value);

            // Handle "Select All" for admins
            const selectAll = document.getElementById('selectAllDepts');
            if (selectAll && selectAll.checked) {
                selectedDepartments.length = 0;
                document.querySelectorAll('.dept-option').forEach(cb => {
                    if (cb.value) {
                        selectedDepartments.push(cb.value);
                    }
                });
            }

            // Validate at least one recipient or department
            if (!recipientEmail && selectedDepartments.length === 0) {
                showNotification('Please specify at least one recipient or department.', 'error');
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

            // Optional recipient email
            if (recipientEmail) {
                formData.append('recipientEmail', recipientEmail);
            }

            formData.append('subject', subject);
            formData.append('content', content);

            // Multiple departments - send as array
            if (selectedDepartments.length > 0) {
                selectedDepartments.forEach(dept => {
                    formData.append('departments', dept);
                });
            }

            formData.append('priority', 'medium');

            // Add uploaded attachments URLs
            uploadedAttachments.forEach(att => {
                formData.append('attachments[]', att.url);
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
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `Server error: ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    // Hide sending modal
                    if (sendingModal) {
                        sendingModal.style.display = 'none';
                    }

                    showNotification(data.message || 'Memo sent successfully', 'success');

                    // Reset form
                    composeForm.reset();
                    if (contentTextarea) {
                        contentTextarea.value = '';
                    }

                    // Clear attachments
                    uploadedAttachments.length = 0;
                    if (attachmentsPreview) {
                        attachmentsPreview.innerHTML = '';
                        attachmentsPreview.style.display = 'none';
                    }

                    // Reset department selections
                    document.querySelectorAll('.dept-option').forEach(cb => {
                        cb.checked = false;
                    });
                    const selectAll = document.getElementById('selectAllDepts');
                    if (selectAll) {selectAll.checked = false;}
                    const dropdownBtn = document.getElementById('deptDropdownBtn');
                    if (dropdownBtn) {dropdownBtn.textContent = 'Select Department(s)...';}

                    // Reset button state
                    if (sendBtn) {
                        sendBtn.disabled = false;
                        if (btnText) {btnText.style.display = 'inline';}
                        if (btnLoading) {btnLoading.style.display = 'none';}
                    }

                    // Close modal after a short delay
                    setTimeout(() => {
                        closeModal(composeModal);
                        fetchMemos();
                    }, 1500);
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
    async function loadDepartments(){
        try{
            const res = await fetch('/api/users/departments');
            const data = await res.json();
            const container = document.getElementById('deptCheckboxesContainer');
            const dropdownBtn = document.getElementById('deptDropdownBtn');
            const dropdown = document.querySelector('.custom-dropdown');

            if (!container || !dropdownBtn || !dropdown) {return;}

            const userRole = window.currentUser?.role || 'faculty';
            const userDepartment = window.currentUser?.department || '';
            const canCrossSend = window.currentUser?.canCrossSend || false;

            container.innerHTML = '';
            const departments = data.departments || [];

            // Filter departments based on role
            let availableDepartments = departments;
            if (userRole === 'secretary' && !canCrossSend) {
                availableDepartments = departments.filter(d => d === userDepartment);
            }

            // Show "Select All" only for admins
            const selectAllCheckbox = document.getElementById('selectAllDepts');
            if (selectAllCheckbox) {
                if (userRole === 'admin') {
                    selectAllCheckbox.parentElement.style.display = 'block';
                    const hr = document.querySelector('.dept-dropdown-hr');
                    if (hr) {hr.style.display = 'block';}
                } else {
                    selectAllCheckbox.parentElement.style.display = 'none';
                    const hr = document.querySelector('.dept-dropdown-hr');
                    if (hr) {hr.style.display = 'none';}
                }
            }

            // Add department checkboxes
            availableDepartments.forEach(dept => {
                const label = document.createElement('label');
                label.className = 'dept-checkbox-label';
                label.innerHTML = `
                    <input type="checkbox" class="dept-checkbox dept-option" value="${dept}">
                    <span>${dept}</span>
                `;
                container.appendChild(label);
            });

            // Update label
            if (userRole === 'admin' || (userRole === 'secretary' && canCrossSend)) {
                document.getElementById('multiSelectLabel').style.display = 'inline';
            }

            // Initialize dropdown functionality
            initCustomDepartmentDropdown();
        }catch(e){
            // eslint-disable-next-line no-console
            console.error('Error loading departments:', e);
        }
    }

    // Initialize custom department dropdown
    function initCustomDepartmentDropdown() {
        const dropdown = document.querySelector('.custom-dropdown');
        const dropdownBtn = document.getElementById('deptDropdownBtn');
        const dropdownMenu = document.getElementById('deptDropdownMenu');
        const selectAll = document.getElementById('selectAllDepts');
        let deptOptions = document.querySelectorAll('.dept-option');

        if (!dropdown || !dropdownBtn || !dropdownMenu) {return;}

        // Toggle dropdown on button click
        dropdownBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });

        // Select All functionality
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                deptOptions = document.querySelectorAll('.dept-option'); // Refresh
                deptOptions.forEach(cb => {
                    cb.checked = selectAll.checked;
                });
                updateDeptButtonLabel();
            });
        }

        // Individual department checkboxes
        function attachCheckboxListeners() {
            deptOptions = document.querySelectorAll('.dept-option'); // Refresh
            deptOptions.forEach(cb => {
                cb.addEventListener('change', () => {
                    if (selectAll && !cb.checked) {
                        selectAll.checked = false;
                    }
                    // Check if all are selected
                    if (selectAll) {
                        const allChecked = Array.from(deptOptions).every(opt => opt.checked);
                        selectAll.checked = allChecked;
                    }
                    updateDeptButtonLabel();
                });
            });
        }

        attachCheckboxListeners();

        // Update button label
        function updateDeptButtonLabel() {
            deptOptions = document.querySelectorAll('.dept-option'); // Refresh
            const selected = Array.from(document.querySelectorAll('.dept-option:checked'))
                .map(cb => cb.value);
            const total = deptOptions.length;
            const placeholder = dropdownBtn.querySelector('.dept-placeholder');

            if (selected.length === 0) {
                if (placeholder) {
                    placeholder.textContent = 'Department(s)';
                } else {
                    dropdownBtn.textContent = 'Department(s)';
                }
                dropdownBtn.classList.add('empty');
            } else {
                dropdownBtn.classList.remove('empty');
                if (placeholder) {
                    if (selected.length === total && selectAll) {
                        placeholder.textContent = 'All Departments';
                    } else if (selected.length === 1) {
                        placeholder.textContent = selected[0];
                    } else {
                        placeholder.textContent = `${selected.length} departments selected`;
                    }
                } else {
                    if (selected.length === total && selectAll) {
                        dropdownBtn.textContent = 'All Departments';
                    } else if (selected.length === 1) {
                        dropdownBtn.textContent = selected[0];
                    } else {
                        dropdownBtn.textContent = `${selected.length} departments selected`;
                    }
                }
            }
        }

        // Expose update function for external use
        window.updateDeptButtonLabel = updateDeptButtonLabel;
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
    backBtn.addEventListener('click', () => {
        showDefaultView();
    });

    // Navigation buttons
    prevBtn.addEventListener('click', () => {
        if (currentMemoIndex > 0) {
            currentMemoIndex--;
            displayMemo(currentMemoIndex);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentMemoIndex < filteredMemos.length - 1) {
            currentMemoIndex++;
            displayMemo(currentMemoIndex);
        }
    });

    // Star button
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

    // Delete button
    deleteBtn.addEventListener('click', async () => {
        if (!currentMemoId) {return;}

        // Store the memo for potential undo
        const memoToDelete = filteredMemos[currentMemoIndex];
        const deletedMemoIndex = currentMemoIndex;
        const deletedMemoId = currentMemoId;

        try {
            const response = await fetch(`/api/log/memos/${currentMemoId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                // Show undo notification
                showUndoNotification('Memo moved to Trash', () => {
                    // Undo function - restore the memo
                    undoDelete(deletedMemoIndex, memoToDelete);
                });

                // Remove from lists
                memos = memos.filter(m => m._id !== currentMemoId);
                filteredMemos = filteredMemos.filter(m => m._id !== currentMemoId);

                // If deleted memo was the current one, go to default view
                if (currentMemoId === deletedMemoId) {
                    showDefaultView();
                }

                renderMemoList();
                fetchMemos();
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error deleting memo', 'error');
        }
    });

    // Fetch memos
    async function fetchMemos() {
        try {
            const response = await fetch(`/api/log/memos?folder=${currentFolder}`);
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

    // Apply filters (department and search)
    function applyFilters() {
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

        renderMemoList();
    }

    // Render memo list
    function renderMemoList() {
        if (filteredMemos.length === 0) {
            memoList.innerHTML = '<div style="padding: 40px; text-align: center; color: #9ca3af;">No memos found</div>';
            return;
        }

        memoList.innerHTML = filteredMemos.map((memo, index) => `
            <div class="memo-item ${index === currentMemoIndex ? 'active' : ''}"
                 data-id="${memo._id}"
                 data-index="${index}">
                <div class="memo-item-header">
                    <img src="${memo.sender?.profilePicture || '/images/memofy-logo.png'}"
                         alt="${memo.sender?.firstName} ${memo.sender?.lastName}"
                         class="memo-avatar">
                    <div class="memo-sender-info">
                        <div class="memo-sender-name">${memo.sender?.firstName} ${memo.sender?.lastName}</div>
                        <div class="memo-sender-email">${memo.sender?.email}</div>
                    </div>
                    ${memo.isStarred ? '<i data-lucide="star" style="width: 16px; height: 16px; color: #fbbf24;"></i>' : ''}
                </div>
                <div class="memo-subject">${memo.subject}</div>
                <div class="memo-preview">- ${memo.content.substring(0, 50)}${memo.content.length > 50 ? '...' : ''}</div>
                <div class="memo-date">${formatDate(memo.createdAt)}</div>
            </div>
        `).join('');

        // Reset select all checkbox
        selectAllMemos.checked = false;

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

    // Display memo
    function displayMemo(index) {
        const memo = filteredMemos[index];

        console.log('Displaying memo:', memo);
        console.log('Index:', index);

        // Show viewer first before trying to access elements
        showMemoViewer();

        // Update the memo viewer content (now that it's visible)
        const senderAvatar = document.getElementById('senderAvatar');
        const senderName = document.getElementById('senderName');
        const senderTitle = document.getElementById('senderTitle');
        const memoBodyContent = document.getElementById('memoBodyContent');
        const attachmentsDiv = document.getElementById('attachments');

        console.log('Elements found:', { senderAvatar, senderName, senderTitle, memoBodyContent, attachmentsDiv });

        if (senderAvatar) {senderAvatar.src = memo.sender?.profilePicture || '/images/memofy-logo.png';}
        if (senderName) {senderName.textContent = `${memo.sender?.firstName} ${memo.sender?.lastName}`;}
        if (senderTitle) {senderTitle.textContent = `${memo.sender?.department || ''} SECRETARY`.trim();}

        // Display memo content with attachments
        if (memoBodyContent) {
            let htmlContent = `<div style="white-space: pre-wrap;">${memo.content}</div>`;

            // Add attachments display if any
            if (memo.attachments && memo.attachments.length > 0) {
                htmlContent += '<div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">';
                htmlContent += '<h4 style="font-size: 0.875rem; font-weight: 600; color: #374151; margin-bottom: 1rem;">Attachments:</h4>';

                memo.attachments.forEach(attachment => {
                    const isImage = attachment.mimetype && attachment.mimetype.startsWith('image/');

                    if (isImage && attachment.path) {
                        // Get just the filename from the path
                        const filename = attachment.path.includes('/') ? attachment.path.split('/').pop() : attachment.path.includes('\\') ? attachment.path.split('\\').pop() : attachment.filename;

                        // Display image inline
                        htmlContent += `
                            <div style="margin-bottom: 1.5rem;">
                                <p style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.5rem;">${attachment.filename}</p>
                                <img src="/uploads/${filename}"
                                     alt="${attachment.filename}"
                                     style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer;"
                                     onerror="this.style.display='none'; console.error('Image not found: ${filename}');" />
                            </div>
                        `;
                    } else {
                        // Display as link for non-images
                        htmlContent += `
                            <div style="display: flex; align-items: center; padding: 0.75rem; background: #f9fafb; border-radius: 8px; margin-bottom: 0.75rem;">
                                <i data-lucide="paperclip" style="width: 16px; height: 16px; margin-right: 0.5rem; color: #6b7280;"></i>
                                <span style="font-size: 0.875rem; color: #374151;">${attachment.filename}</span>
                                <span style="font-size: 0.75rem; color: #9ca3af; margin-left: auto;">(${formatFileSize(attachment.size)})</span>
                            </div>
                        `;
                    }
                });

                htmlContent += '</div>';
            }

            memoBodyContent.innerHTML = htmlContent;

            // Reinitialize icons for attachment links
            lucide.createIcons();
        }

        // Update navigation buttons
        if (prevBtn) {prevBtn.disabled = index === 0;}
        if (nextBtn) {nextBtn.disabled = index === filteredMemos.length - 1;}
        if (memoCounter) {memoCounter.textContent = `${index + 1} of ${filteredMemos.length}`;}

        // Update star button
        updateStarButton(memo.isStarred);

        // Show attachments
        if (attachmentsDiv) {
            if (memo.attachments && memo.attachments.length > 0) {
                attachmentsDiv.innerHTML = `
                    <div class="attachment-item">
                        <i data-lucide="file-text" class="attachment-icon"></i>
                        <div class="attachment-info">
                            <div class="attachment-filename">${memo.attachments[0].filename || 'Document.pdf'}</div>
                            <div class="attachment-size">${formatFileSize(memo.attachments[0].size || 0)}</div>
                        </div>
                    </div>
                `;
                lucide.createIcons();
            } else {
                attachmentsDiv.innerHTML = '';
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
    }

    // Hide memo viewer
    function hideMemoViewer() {
        showDefaultView();
    }

    // Update star button
    function updateStarButton(isStarred) {
        const icon = starBtn.querySelector('i');
        if (isStarred) {
            icon.setAttribute('data-lucide', 'star');
            icon.style.color = '#fbbf24';
            starBtn.style.color = '#fbbf24';
        } else {
            icon.setAttribute('data-lucide', 'bookmark');
            icon.style.color = '#6b7280';
            starBtn.style.color = '#6b7280';
        }
        lucide.createIcons();
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
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal);
        });
    });

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

