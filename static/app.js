document.addEventListener('DOMContentLoaded', () => {
    const deviceSelect = document.getElementById('device-select');
    const refreshDevicesBtn = document.getElementById('refresh-devices');
    const connectAddressInput = document.getElementById('connect-address');
    const connectBtn = document.getElementById('connect-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Shell
    const shellForm = document.getElementById('shell-form');
    const shellInput = document.getElementById('shell-input');
    const terminalOutput = document.getElementById('terminal-output');

    // Terminal (Interactive)
    const xtermContainer = document.getElementById('xterm-container');
    let term = null;
    let ws = null;
    let fitAddon = null;

    // Files
    const currentPathInput = document.getElementById('current-path');
    const goPathBtn = document.getElementById('go-path');
    const upPathBtn = document.getElementById('up-path');
    const fileList = document.getElementById('file-list');
    const uploadInput = document.getElementById('upload-input');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadTriggerBtn = document.getElementById('upload-trigger-btn');
    const breadcrumbsContainer = document.getElementById('breadcrumbs');
    const fileTree = document.getElementById('file-tree');

    // Screenshot
    const captureBtn = document.getElementById('capture-btn');
    const screenshotImg = document.getElementById('screenshot-img');

    // Spy Info
    const spyBtns = document.querySelectorAll('.spy-btn');
    const spyOutput = document.getElementById('spy-output');

    // Settings
    const langToggleBtn = document.getElementById('lang-toggle');
    const themeToggleBtn = document.getElementById('theme-toggle');
    let currentLang = 'en';
    let currentTheme = 'dark';

    const i18n = {
        en: {
            device: 'Device:',
            select_device: 'Select a device',
            refresh: 'Refresh',
            tab_shell: 'Shell',
            tab_terminal: 'Terminal (Interactive)',
            tab_files: 'Files',
            tab_screenshot: 'Screenshot',
            tab_spy_info: 'Spy Info',
            tab_control: 'Control',
            btn_contacts: 'Get Contacts',
            btn_sms: 'Get SMS',
            btn_location: 'Get Location',
            btn_wifi: 'Get WiFi Info',
            btn_battery: 'Get Battery',
            btn_cpu: 'Get CPU',
            btn_version: 'Get Android Version',
            btn_model: 'Get Model',
            connect: 'Connect',
            connecting: 'Connecting...',
            connected: 'Connected'
        },
        cn: {
            device: '设备:',
            select_device: '选择设备',
            refresh: '刷新',
            tab_shell: 'Shell',
            tab_terminal: '终端 (交互式)',
            tab_files: '文件管理',
            tab_screenshot: '屏幕截图',
            tab_spy_info: '信息获取',
            tab_control: '设备控制',
            btn_contacts: '获取联系人',
            btn_sms: '获取短信',
            btn_location: '获取位置',
            btn_wifi: '获取WiFi',
            btn_battery: '获取电池',
            btn_cpu: '获取CPU',
            btn_version: '获取安卓版本',
            btn_model: '获取型号',
            connect: '连接',
            connecting: '连接中...',
            connected: '已连接'
        }
    };

    function setLanguage(lang) {
        currentLang = lang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[lang][key]) {
                el.textContent = i18n[lang][key];
            }
        });
        langToggleBtn.textContent = lang === 'en' ? 'CN' : 'EN';
    }

    function toggleTheme() {
        if (document.body.classList.contains('light-theme')) {
            document.body.classList.remove('light-theme');
            themeToggleBtn.textContent = '🌗';
            currentTheme = 'dark';
        } else {
            document.body.classList.add('light-theme');
            themeToggleBtn.textContent = '☀️';
            currentTheme = 'light';
        }
    }

    langToggleBtn.addEventListener('click', () => {
        setLanguage(currentLang === 'en' ? 'cn' : 'en');
    });

    themeToggleBtn.addEventListener('click', toggleTheme);

    // Init
    let currentSerial = '';
    fetchDevices();

    // Event Listeners
    refreshDevicesBtn.addEventListener('click', fetchDevices);
    
    connectBtn.addEventListener('click', async () => {
        const address = connectAddressInput.value.trim();
        if (!address) return alert('Enter IP:Port');

        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting...';

        try {
            const res = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || await res.text());
            
            alert(data.message || 'Connected');
            connectAddressInput.value = '';
            fetchDevices();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect';
        }
    });

    deviceSelect.addEventListener('change', (e) => {
        currentSerial = e.target.value;
        if (currentSerial) {
            // Refresh current view
            const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
            if (activeTab === 'files') fetchFiles();
            if (activeTab === 'terminal') initTerminal();
        }
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            
            if (btn.dataset.tab === 'files' && currentSerial) {
                fetchFiles();
            }
            if (btn.dataset.tab === 'terminal' && currentSerial) {
                // Delay slightly to ensure container is visible for sizing
                setTimeout(initTerminal, 100);
            }
        });
    });

    // Shell Logic (One-off)
    shellForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentSerial) return alert('Please select a device');
        
        const cmd = shellInput.value;
        if (!cmd) return;

        appendOutput(`$ ${cmd}\n`);
        shellInput.value = '';

        try {
            const res = await fetch('/api/shell', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serial: currentSerial, command: cmd })
            });
            const data = await res.json();
            if (data.error) {
                appendOutput(`Error: ${data.error}\n`);
            } else {
                appendOutput(data.output + '\n');
            }
        } catch (err) {
            appendOutput(`Error: ${err.message}\n`);
        }
    });

    function appendOutput(text) {
        terminalOutput.textContent += text;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // Interactive Terminal Logic
    function initTerminal() {
        if (!currentSerial) return;
        if (term) {
            term.dispose(); // Re-create to clear old state or resize properly
        }
        if (ws) {
            ws.close();
        }

        term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#000000',
                foreground: '#00ff00'
            }
        });
        
        fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);
        term.open(xtermContainer);
        fitAddon.fit();

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/shell?serial=${currentSerial}`);
        ws.binaryType = 'arraybuffer'; // Optimize for binary data

        ws.onopen = () => {
            term.writeln('Connected to adb shell...\r\n');
        };

        ws.onmessage = (ev) => {
            if (ev.data instanceof ArrayBuffer) {
                 term.write(new Uint8Array(ev.data));
            } else {
                term.write(ev.data);
            }
        };

        ws.onclose = () => {
            term.writeln('\r\nConnection closed.\r\n');
        };

        ws.onerror = (err) => {
            term.writeln('\r\nWebSocket error.\r\n');
        };

        term.onData(data => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });
        
        // Handle resize
        window.addEventListener('resize', () => fitAddon.fit());
    }

    // File Logic
    async function fetchFiles() {
        if (!currentSerial) return;
        const path = currentPathInput.value;
        
        updateBreadcrumbs(path);
        
        // Update tree selection if exists
        document.querySelectorAll('.tree-item').forEach(item => {
            if (item.dataset.path === path) item.classList.add('active');
            else item.classList.remove('active');
        });

        fileList.innerHTML = '<div style="padding:10px">Loading...</div>';
        
        try {
            const res = await fetch(`/api/files?serial=${currentSerial}&path=${encodeURIComponent(path)}`);
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to load files');
            const files = await res.json();
            renderFiles(files);
        } catch (err) {
            fileList.innerHTML = `<div style="color:red; padding:10px">Error: ${err.message}</div>`;
        }
    }

    function renderFiles(files) {
        fileList.innerHTML = '';
        if (!files || files.length === 0) {
            fileList.innerHTML = '<div style="padding:10px; color: #888;">Empty directory</div>';
            return;
        }

        // Sort: directories first, then files
        files.sort((a, b) => {
            if (a.is_dir === b.is_dir) return a.name.localeCompare(b.name);
            return a.is_dir ? -1 : 1;
        });

        files.forEach(file => {
            const item = document.createElement('div');
            item.className = `file-item ${file.is_dir ? 'is-dir' : ''}`;
            item.onclick = (e) => {
                // Prevent clicking actions from triggering this
                if (e.target.tagName === 'BUTTON') return;
                
                if (file.is_dir) {
                    let newPath = currentPathInput.value;
                    if (!newPath.endsWith('/')) newPath += '/';
                    currentPathInput.value = newPath + file.name;
                    fetchFiles();
                }
            };
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'file-name';
            nameDiv.innerHTML = `<span class="file-icon">${file.is_dir ? '📁' : '📄'}</span> ${file.name}`;

            const sizeSpan = document.createElement('span');
            sizeSpan.textContent = file.is_dir ? '-' : file.size;

            const dateSpan = document.createElement('span');
            dateSpan.textContent = `${file.date} ${file.time}`;

            const actionsSpan = document.createElement('div');
            actionsSpan.className = 'file-actions'; // Add class for styling if needed

            // Actions for both files and directories (delete/rename)
            // But let's keep it simple for now
            
            if (!file.is_dir) {
                // View
                const viewBtn = document.createElement('button');
                viewBtn.textContent = 'View';
                viewBtn.onclick = (e) => {
                    e.stopPropagation();
                    let filePath = currentPathInput.value;
                    if (!filePath.endsWith('/')) filePath += '/';
                    filePath += file.name;
                    window.open(`/api/view?serial=${currentSerial}&path=${encodeURIComponent(filePath)}`, '_blank');
                };
                actionsSpan.appendChild(viewBtn);

                // Download
                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = 'Download';
                downloadBtn.onclick = (e) => {
                    e.stopPropagation();
                    let filePath = currentPathInput.value;
                    if (!filePath.endsWith('/')) filePath += '/';
                    filePath += file.name;
                    window.location.href = `/api/download?serial=${currentSerial}&path=${encodeURIComponent(filePath)}`;
                };
                actionsSpan.appendChild(downloadBtn);
            }

            // Rename
            const renameBtn = document.createElement('button');
            renameBtn.textContent = 'Rename';
            renameBtn.onclick = async (e) => {
                e.stopPropagation();
                let oldPath = currentPathInput.value;
                if (!oldPath.endsWith('/')) oldPath += '/';
                oldPath += file.name;

                const newName = prompt('Enter new name:', file.name);
                if (!newName || newName === file.name) return;

                let newPath = currentPathInput.value;
                if (!newPath.endsWith('/')) newPath += '/';
                newPath += newName;

                try {
                    const res = await fetch('/api/rename', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ serial: currentSerial, oldPath, newPath })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || await res.text());
                    alert(data.message);
                    fetchFiles();
                } catch (err) {
                    alert('Rename failed: ' + err.message);
                }
            };
            actionsSpan.appendChild(renameBtn);

            // Delete
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.style.backgroundColor = '#d9534f'; // Red warning color
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;

                let filePath = currentPathInput.value;
                if (!filePath.endsWith('/')) filePath += '/';
                filePath += file.name;

                try {
                    const res = await fetch(`/api/delete?serial=${currentSerial}&path=${encodeURIComponent(filePath)}`, {
                        method: 'POST'
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || await res.text());
                    alert(data.message);
                    fetchFiles();
                } catch (err) {
                    alert('Delete failed: ' + err.message);
                }
            };
            actionsSpan.appendChild(deleteBtn);

            item.appendChild(nameDiv);
            item.appendChild(sizeSpan);
            item.appendChild(dateSpan);
            item.appendChild(actionsSpan);
            fileList.appendChild(item);
        });
    }

    function updateBreadcrumbs(path) {
        breadcrumbsContainer.innerHTML = '';
        
        // Handle root
        const parts = path.split('/').filter(p => p);
        
        // Root link
        const rootSpan = document.createElement('span');
        rootSpan.className = 'breadcrumb-item';
        rootSpan.textContent = 'root';
        rootSpan.onclick = () => {
            currentPathInput.value = '/';
            fetchFiles();
        };
        breadcrumbsContainer.appendChild(rootSpan);

        if (parts.length > 0) {
             const sep = document.createElement('span');
             sep.className = 'breadcrumb-separator';
             sep.textContent = '/';
             breadcrumbsContainer.appendChild(sep);
        }

        let currentBuildPath = '';
        parts.forEach((part, index) => {
            currentBuildPath += '/' + part;
            
            const partSpan = document.createElement('span');
            partSpan.className = 'breadcrumb-item';
            partSpan.textContent = part;
            const clickPath = currentBuildPath; // Closure capture
            partSpan.onclick = () => {
                currentPathInput.value = clickPath;
                fetchFiles();
            };
            breadcrumbsContainer.appendChild(partSpan);

            if (index < parts.length - 1) {
                const sep = document.createElement('span');
                sep.className = 'breadcrumb-separator';
                sep.textContent = '/';
                breadcrumbsContainer.appendChild(sep);
            }
        });
    }

    goPathBtn.addEventListener('click', fetchFiles);
    
    upPathBtn.addEventListener('click', () => {
        let path = currentPathInput.value;
        // Remove trailing slash if exists (unless root)
        if (path.length > 1 && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        const lastSlash = path.lastIndexOf('/');
        if (lastSlash >= 0) {
            path = path.substring(0, lastSlash);
        }
        if (path === '') path = '/';
        currentPathInput.value = path;
        fetchFiles();
    });

    // Sidebar Tree Click
    fileTree.addEventListener('click', (e) => {
        if (e.target.classList.contains('tree-item')) {
            const path = e.target.dataset.path;
            currentPathInput.value = path;
            fetchFiles();
        }
    });

    // Upload
    uploadTriggerBtn.addEventListener('click', () => {
        uploadInput.click();
    });

    uploadInput.addEventListener('change', () => {
        if (uploadInput.files.length > 0) {
            uploadBtn.classList.remove('hidden');
            uploadTriggerBtn.textContent = `Selected: ${uploadInput.files[0].name}`;
        }
    });

    uploadBtn.addEventListener('click', async () => {
        if (!currentSerial) return alert('Please select a device');
        if (uploadInput.files.length === 0) return alert('Select a file');

        const formData = new FormData();
        formData.append('file', uploadInput.files[0]);
        formData.append('serial', currentSerial);
        formData.append('path', currentPathInput.value);

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error((await res.json()).message || await res.text());
            alert('Upload successful');
            fetchFiles();
            
            // Reset UI
            uploadInput.value = '';
            uploadBtn.classList.add('hidden');
            uploadTriggerBtn.textContent = 'Upload File';
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Confirm Upload';
        }
    });

    // Screenshot Logic
    captureBtn.addEventListener('click', () => {
        if (!currentSerial) return alert('Please select a device');
        const timestamp = new Date().getTime();
        screenshotImg.src = `/api/screenshot?serial=${currentSerial}&t=${timestamp}`;
    });

    // Spy Info Logic
    // const spyBtns = document.querySelectorAll('.spy-btn'); // Removed duplicate declaration
    spyBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!currentSerial) {
                alert(currentLang === 'cn' ? '请选择设备' : 'Please select a device');
                return;
            }
            const type = btn.dataset.type;
            
            spyOutput.textContent = 'Loading...';
            
            try {
                const res = await fetch(`/api/info/${type}?serial=${currentSerial}`);
                const data = await res.json();
                
                if (data.error) throw new Error(data.error);
                
                // Format output
                if (type === 'contacts' || type === 'sms') {
                     if (data.data && data.data.length > 0) {
                         spyOutput.textContent = JSON.stringify(data.data, null, 2);
                     } else {
                         spyOutput.textContent = (currentLang === 'cn' ? '未找到数据或无权限。原始输出：\n' : 'No data found or permission denied. Raw output:\n') + (data.raw || '');
                     }
                } else if (type === 'version') {
                     spyOutput.textContent = (currentLang === 'cn' ? '安卓版本: ' : 'Android Version: ') + (data.data || data.raw || '');
                } else {
                    // Generic handler for location, wifi, battery, cpu, version, model
                    if (Array.isArray(data.data)) {
                        spyOutput.textContent = data.data.join('\n') || data.raw;
                    } else {
                        spyOutput.textContent = data.data || data.raw || JSON.stringify(data);
                    }
                }
            } catch (err) {
                spyOutput.textContent = 'Error: ' + err.message;
            }
        });
    });

    // Control Tab Logic
    const controlBtns = document.querySelectorAll('.control-btn');
    const controlStatus = document.getElementById('control-status');

    controlBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!currentSerial) return alert('Please select a device');
            
            const action = btn.dataset.action;
            let cmd = '';

            switch (action) {
                case 'calculator':
                    cmd = 'am start -n com.oneplus.calculator/.Calculator';
                    break;
                case 'volume-up':
                    cmd = 'input keyevent 24';
                    break;
                case 'volume-down':
                    cmd = 'input keyevent 25';
                    break;
                case 'home':
                    cmd = 'input keyevent 3';
                    break;
                case 'back':
                    cmd = 'input keyevent 4';
                    break;
                case 'lock':
                    cmd = 'input keyevent 276';
                    break;
            }

            if (!cmd) return;

            controlStatus.textContent = `Executing: ${cmd}...`;
            
            try {
                const res = await fetch('/api/shell', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ serial: currentSerial, command: cmd })
                });
                const data = await res.json();
                
                if (data.error) {
                    controlStatus.textContent = `Error: ${data.error}`;
                } else {
                    controlStatus.textContent = `Success: ${data.output || 'Command executed'}`;
                }
            } catch (err) {
                controlStatus.textContent = `Request Failed: ${err.message}`;
            }
        });
    });

    // Helper: Fetch Devices
    async function fetchDevices() {
        try {
            const res = await fetch('/api/devices');
            const devices = await res.json();
            
            // Keep selected if still exists
            const selected = deviceSelect.value;
            deviceSelect.innerHTML = '<option value="">Select a device</option>';
            
            if (devices) {
                devices.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.serial;
                    opt.textContent = `${d.model || 'Unknown'} (${d.serial}) - ${d.state}`;
                    deviceSelect.appendChild(opt);
                });
            }

            if (selected && Array.from(deviceSelect.options).some(o => o.value === selected)) {
                deviceSelect.value = selected;
            } else if (devices && devices.length > 0) {
                 // Auto select first
                 deviceSelect.value = devices[0].serial;
                 currentSerial = devices[0].serial;
                 // Refresh active view
                 const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
                 if (activeTab === 'files') fetchFiles();
                 if (activeTab === 'terminal') initTerminal();
            }
        } catch (err) {
            console.error('Failed to fetch devices', err);
        }
    }
});
