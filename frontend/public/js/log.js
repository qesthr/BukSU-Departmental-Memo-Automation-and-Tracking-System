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
    const deptFilterBtns = document.querySelectorAll('.dept-filter-btn');

    let currentFolder = 'inbox';
    let currentDeptFilter = 'all';
    let memos = [];
    let filteredMemos = [];
    let currentMemoIndex = -1;
    let currentMemoId = null;

    // Initialize
    fetchMemos();

    // Compose button
    composeBtn.addEventListener('click', () => {
        openModal(composeModal);
    });

    // Folder switching
    folderItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            folderItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentFolder = item.dataset.folder;
            fetchMemos();
        });
    });

    // Department filtering
    deptFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            deptFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDeptFilter = btn.dataset.dept;
            applyFilters();
        });
    });

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

    // Rich text editor with inline image support
    const contentEditor = document.getElementById('contentEditor');
    const contentHidden = document.getElementById('content');
    const insertImageBtn = document.getElementById('insertImageBtn');
    const imageUpload = document.getElementById('imageUpload');
    const uploadedImages = []; // Store uploaded images for submission

    // Insert image button handler
    if (insertImageBtn && imageUpload) {
        insertImageBtn.addEventListener('click', () => {
            imageUpload.click();
        });

        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                // Create preview
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';

                    // Insert image at cursor position
                    if (window.getSelection().rangeCount > 0) {
                        const range = window.getSelection().getRangeAt(0);
                        range.insertNode(img);
                        // Move cursor after image
                        range.setStartAfter(img);
                        range.collapse(true);
                        window.getSelection().removeAllRanges();
                        window.getSelection().addRange(range);
                    } else {
                        contentEditor.appendChild(img);
                    }

                    // Store for submission
                    uploadedImages.push(file);
                    contentHidden.value = 'hasContent'; // Set value so form validates
                };
                reader.readAsDataURL(file);

                lucide.createIcons();
                e.target.value = ''; // Reset input
            }
        });
    }

    // Convert editor content to text when submitting
    if (contentEditor) {
        contentEditor.addEventListener('input', () => {
            // Extract text from editor for hidden input
            const textContent = contentEditor.innerText;
            if (textContent.trim()) {
                contentHidden.value = textContent;
            } else {
                contentHidden.value = contentEditor.innerHTML;
            }
        });
    }

    // Compose form
    composeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Extract text content from rich editor
        const editorContent = contentEditor.innerHTML;
        const textContent = contentEditor.innerText || editorContent;

        // Create FormData
        const formData = new FormData();
        formData.append('recipientEmail', document.getElementById('recipientEmail').value);
        formData.append('subject', document.getElementById('subject').value);
        formData.append('content', textContent); // Send plain text
        formData.append('department', document.getElementById('department').value);
        formData.append('priority', 'medium');
        formData.append('editorContent', editorContent); // Also send HTML content

        // Add uploaded images as attachments
        if (uploadedImages.length > 0) {
            uploadedImages.forEach(file => {
                formData.append('attachments', file);
            });
        }

        try {
            const response = await fetch('/api/log/memos', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Memo sent successfully', 'success');
                composeForm.reset();
                if (contentEditor) contentEditor.innerHTML = '';
                uploadedImages.length = 0; // Clear uploaded images
                closeModal(composeModal);
                fetchMemos();
            } else {
                showNotification(data.message || 'Error sending memo', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error sending memo', 'error');
        }
    });

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
        if (!currentMemoId) return;

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
        if (!currentMemoId) return;

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
        // Filter by department
        filteredMemos = memos.filter(memo => {
            if (currentDeptFilter === 'all') return true;
            return memo.department === currentDeptFilter || memo.sender?.department === currentDeptFilter;
        });

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
                if (e.target.type === 'checkbox') return;
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

        if (senderAvatar) senderAvatar.src = memo.sender?.profilePicture || '/images/memofy-logo.png';
        if (senderName) senderName.textContent = `${memo.sender?.firstName} ${memo.sender?.lastName}`;
        if (senderTitle) senderTitle.textContent = `${memo.sender?.department || ''} SECRETARY`.trim();

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
        if (prevBtn) prevBtn.disabled = index === 0;
        if (nextBtn) nextBtn.disabled = index === filteredMemos.length - 1;
        if (memoCounter) memoCounter.textContent = `${index + 1} of ${filteredMemos.length}`;

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
        if (emptyState) emptyState.style.display = 'none';
        if (memoViewer) memoViewer.style.display = 'flex';
    }

    // Show default empty view
    function showDefaultView() {
        if (emptyState) emptyState.style.display = 'flex';
        if (memoViewer) memoViewer.style.display = 'none';
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
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
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

    // Notification helper
    function showNotification(message, type) {
        console.log(`${type}: ${message}`);
        // You can implement a toast notification here
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

