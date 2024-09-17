import { app } from "../../scripts/app.js";

// Adds a gallery to the Load Image node and tabs for Load Checkpoint/Lora/etc Nodes

const ext = {
    name: "Comfy.LoadImageGallery",
    async init() {
        const ctxMenu = LiteGraph.ContextMenu;
        const style = document.createElement('style');
        style.textContent = `
            .comfy-context-menu-filter {
                grid-area: 1 / 1 / 2 / 5;
            }
            .image-entry {
                width: 80px;
                height: 80px;
                background-size: cover;
                background-position: center;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                font-size: 0!important;
                position: relative;
            }
			.delete-button {
                position: absolute;
                top: 2px;
                right: 2px;
                width: 20px;
                height: 20px;
                background-color: rgba(255, 0, 0, 0.7);
                color: white;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                cursor: pointer;
                font-size: 14px !important;
            }
			.tab {
			  padding: 5px 10px;
			  margin-right: 5px;
			  background-color: transparent;
			  border: none;
			  cursor: pointer;
			}

			.tab:last-child {
			  margin-right: 0;
			}

			.tab.active {
			  border-bottom: 3px solid #64b5f6;
			}
        `;
        document.head.append(style);
		let FirstRun = true;
		function CleanDB(values) {
			const valuesSet = new Set(values);
			const transaction = db.transaction(['thumbnails'], 'readwrite');
			const store = transaction.objectStore('thumbnails');
			const request = store.getAll();

			request.onsuccess = async event => {
				const thumbnails = event.target.result;

				for (const thumbnail of thumbnails) {
					if (!valuesSet.has(thumbnail.filename)) {
						await removeThumbnail(thumbnail.filename);
						console.log(`Removed stale thumbnail: ${thumbnail.filename}`);
					}
				}
			};
			request.onerror = event => console.error("Error reading thumbnails from DB: " + event.target.error);
			FirstRun = false;
		};
        async function deleteFile(filename) {
            try {
                const response = await fetch('/delete_file', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ filename }),
                });
                if (response.ok) {
                    console.log(`File ${filename} deleted successfully`);
                    return true;
                } else {
                    console.error(`Failed to delete file ${filename}`);
                    return false;
                }
            } catch (error) {
                console.error('Error deleting file:', error);
                return false;
            }
        }
		async function removeThumbnail(filename) {
			return new Promise((resolve, reject) => {
				const transaction = db.transaction(['thumbnails'], 'readwrite');
				const store = transaction.objectStore('thumbnails');
				const request = store.delete(filename);
				request.onerror = event => reject("Error removing thumbnail: " + event.target.error);
				request.onsuccess = event => resolve();
			});
		}
        const dbName = 'ImageThumbnailsDB';
        const dbVersion = 1;
        let db;

        const dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, dbVersion);
            request.onerror = event => reject("IndexedDB error: " + event.target.error);
            request.onsuccess = event => {
                db = event.target.result;
                resolve(db);
            };
            request.onupgradeneeded = event => {
                const db = event.target.result;
                db.createObjectStore('thumbnails', { keyPath: 'filename' });
            };
        });

        await dbPromise;

        async function getThumbnail(filename) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['thumbnails'], 'readonly');
                const store = transaction.objectStore('thumbnails');
                const request = store.get(filename);
                request.onerror = event => reject("Error fetching thumbnail: " + event.target.error);
                request.onsuccess = event => resolve(event.target.result ? event.target.result.data : null);
            });
        }

        async function saveThumbnail(filename, data) {
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['thumbnails'], 'readwrite');
                const store = transaction.objectStore('thumbnails');
                const request = store.put({ filename, data });
                request.onerror = event => reject("Error saving thumbnail: " + event.target.error);
                request.onsuccess = event => resolve();
            });
        }

        function createThumbnail(file) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 80;
                    canvas.height = 80;
                    
                    const aspectRatio = img.width / img.height;
                    let srcWidth, srcHeight, srcX, srcY;
                    
                    if (aspectRatio > 1) {
                        srcHeight = img.height;
                        srcWidth = srcHeight;
                        srcX = (img.width - srcWidth) / 2;
                        srcY = 0;
                    } else {
                        srcWidth = img.width;
                        srcHeight = srcWidth;
                        srcX = 0;
                        srcY = (img.height - srcHeight) / 2;
                    }
                    
                    ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, 80, 80);
                    resolve(canvas.toDataURL("image/jpeg"));
                };
                img.src = `http://${location.host}/view?filename=${encodeURIComponent(file)}&type=input`;
            });
        }

        LiteGraph.ContextMenu = function (values, options) {
            const ctx = ctxMenu.call(this, values, options);
            if (options?.className === "dark" && values?.length > 0) {
                const items = Array.from(ctx.root.querySelectorAll(".litemenu-entry"));
                let displayedItems = [...items];

				function UpdatePosition() {
					let top = options.event.clientY - 10;
					const bodyRect = document.body.getBoundingClientRect();
					const rootRect = ctx.root.getBoundingClientRect();
					if (bodyRect.height && top > bodyRect.height - rootRect.height - 10) {
					top = Math.max(0, bodyRect.height - rootRect.height - 10);
					}
					ctx.root.style.top = top + "px";
				}
			requestAnimationFrame(() => {			
				const currentNode = LGraphCanvas.active_canvas.current_node;
				const clickedComboValue = currentNode.widgets?.filter(
				(w) => w.type === "combo" && w.options.values.length === values.length
				).find(
				(w) => w.options.values.every((v, i) => v === values[i])
				)?.value;
				let selectedIndex = clickedComboValue ? values.findIndex((v) => v === clickedComboValue) : 0;
				if (selectedIndex < 0) {
				selectedIndex = 0;
				}
				const selectedItem = displayedItems[selectedIndex];

				//Tabs
				const hasBackslash = values.some(value => value.includes('\\'));

				if (hasBackslash) {
					const input = ctx.root.querySelector('input');

					// Create a data structure for folders and files
					const structure = { Root: { files: [] } };
					items.forEach(entry => {
						const path = entry.getAttribute('data-value');
						const parts = path.split('\\');
						let current = structure;
						if (parts.length === 1) {
						  structure.Root.files.push(entry);
						} else {
						  for (let i = 0; i < parts.length - 1; i++) {
							const folder = parts[i];
							if (!current[folder]) current[folder] = { files: [] };
							current = current[folder];
						  }
						  current.files.push(entry);
						}
					});

					// Function for creating tabs
					function createTabs(container, structure) {
					Object.keys(structure).forEach(key => {
					  if (key === 'files') return;
					  const tab = document.createElement('button');
					  tab.textContent = key;
					  tab.className = 'tab';
					  tab.onclick = () => showGroup(container, key, structure);
					  if (key === 'Root')
					  {
						container.prepend(tab);  
					  }
						else{
							container.appendChild(tab);
						  }
					});
					}

					// Function to display the contents of a folder
					function showGroup(container, folder, parent) {
					  // Removing existing subfolder tabs
					  const subtabs = container.querySelectorAll('.subtabs');
					  subtabs.forEach(subtab => subtab.remove());

					  const current = parent[folder];
					  const files = current.files || [];
					  const subfolders = Object.keys(current).filter(key => key !== 'files');

					  // Hide all files and folders
					  items.forEach(entry => entry.style.display = 'none');

					  // Display files in the current folder
					  if (folder === 'Root') {
						items.forEach(item => {
						  const itemPath = item.getAttribute('data-value');
						  if (!itemPath.includes('\\')) {
							item.style.display = 'block';
						  }
						});
					  } else {
						files.forEach(file => file.style.display = 'block');
					  }

					  // Display tabs for nested folders
					  if (subfolders.length > 0) {
						const subtabsContainer = document.createElement('div');
						subtabsContainer.className = 'subtabs';
						container.appendChild(subtabsContainer);
						createTabs(subtabsContainer, current);

						// Display the contents of nested folders
						subfolders.forEach(subfolder => {
						  const subtab = Array.from(subtabsContainer.querySelectorAll('button')).find(tab => tab.textContent === subfolder);
						  if (subtab) {
							subtab.onclick = () => showGroup(subtabsContainer, subfolder, current);
						  }
						});
					  }

					  // Remove old tabs
					  container.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
					  const tabs = container.querySelectorAll('button');
					  tabs.forEach(tab => {
						if (tab.textContent === folder) {
						  tab.classList.add('active');
						}
					  });
					}

					// Creating a Container for Tabs
					const tabsContainer = document.createElement('div');
					tabsContainer.className = 'tabs';
					input.insertAdjacentElement('afterend', tabsContainer);

					createTabs(tabsContainer, structure);

					// Select the active tab
					const selectedPath = selectedItem.getAttribute('data-value').split('\\');
					const selectedFolders = selectedPath.slice(0, -1);

					if (selectedFolders.length === 0) {
					  showGroup(tabsContainer, 'Root', structure);
					} else {
					let currentContainer = tabsContainer;
					let currentParent = structure;

					selectedFolders.forEach((folder, index) => {
						showGroup(currentContainer, folder, currentParent);

						const subtabs = currentContainer.querySelectorAll('.subtabs');
						currentContainer = subtabs[subtabs.length - 1];
						currentParent = currentParent[folder];

						if (index < selectedFolders.length - 1) {
						  const nextFolder = selectedFolders[index + 1];
						  const tabs = currentContainer.querySelectorAll('button');
						  tabs.forEach(tab => {
							if (tab.textContent === nextFolder) {
							  tab.classList.add('active');
							}
						  });
						}
					  });
					}

					UpdatePosition();
				}

				//Gallery
				if (values.length > 0 && currentNode.type === "LoadImage") {
					if (FirstRun) {
						CleanDB(values);
					}
					options.scroll_speed = 0.5;
					ctx.root.style.display = 'grid';
					ctx.root.style.gridTemplateColumns = 'repeat(4, 88px)';
					if (displayedItems.length > 30) {
						UpdatePosition();
					}

					items.forEach(async (entry, index) => {
						const filename = values[index];
						entry.classList.add('image-entry');
						entry.setAttribute('title', filename);
						
						let thumbnailUrl = await getThumbnail(filename);
						if (!thumbnailUrl) {
							thumbnailUrl = await createThumbnail(filename);
							await saveThumbnail(filename, thumbnailUrl);
						}

						entry.style.backgroundImage = `url('${thumbnailUrl}')`;
						
						const deleteButton = document.createElement('div');
						deleteButton.classList.add('delete-button');
						deleteButton.textContent = '×';
						deleteButton.setAttribute('title', 'Delete');
						deleteButton.addEventListener('click', async (e) => {
							e.stopPropagation();
							if (await deleteFile(filename)) {
								entry.remove();
								await removeThumbnail(filename);
								
								values.splice(index, 1);
							}
						});
						entry.appendChild(deleteButton);
					});
			}			
				
				});
            }

            return ctx;
        };

        LiteGraph.ContextMenu.prototype = ctxMenu.prototype;
    },
}

app.registerExtension(ext);