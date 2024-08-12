import { app } from "../../scripts/app.js";

// Adds a gallery to the Load Image node

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
        `;
        document.head.append(style);

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

        LiteGraph.ContextMenu = function (values, options) {
            const ctx = ctxMenu.call(this, values, options);
            if (options?.className === "dark" && values?.length > 0) {
                const items = Array.from(this.root.querySelectorAll(".litemenu-entry"));
                let displayedItems = [...items];

                function isImageFile(filename) {
                    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
                    const extension = filename.split('.').pop().toLowerCase();
                    return imageExtensions.includes(extension);
                }

                if (values.length > 0 && isImageFile(values[0])) {
                    options.scroll_speed = 0.5;
                    this.root.style.display = 'grid';
                    this.root.style.gridTemplateColumns = 'repeat(4, 88px)';
					if (displayedItems.length > 30)
					{
                    this.root.style.top = '100px';
					}					
                    
                    items.forEach(entry => {
                        const filename = entry.textContent;
						const encodedFilename = encodeURIComponent(filename);
                        entry.style.backgroundImage = `url('http://${location.host}/view?filename=${encodedFilename}&type=input')`;
                        entry.classList.add('image-entry');
                        entry.setAttribute('title', filename);
                        const deleteButton = document.createElement('div');
                        deleteButton.classList.add('delete-button');
                        deleteButton.textContent = '×';
						deleteButton.setAttribute('title', 'Delete');
                        deleteButton.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            if (await deleteFile(filename)) {
                                entry.remove();
                                // Удаляем файл из values
                                const index = values.indexOf(filename);
                                if (index > -1) {
                                    values.splice(index, 1);
                                }
                            }
                        });
                        entry.appendChild(deleteButton);
                    });
                }
            }

            return ctx;
        };

        LiteGraph.ContextMenu.prototype = ctxMenu.prototype;
    },
}

app.registerExtension(ext);
