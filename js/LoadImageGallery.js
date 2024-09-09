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
        `;
        document.head.append(style);

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
                const items = Array.from(document.querySelectorAll(".litemenu-entry"));
                const mroot = document.querySelector(".litecontextmenu");
                let displayedItems = [...items];

                function isImageFile(filename) {
                    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
                    const extension = filename.split('.').pop().toLowerCase();
                    return imageExtensions.includes(extension);
                }

                if (values.length > 0 && isImageFile(values[0])) {
                    options.scroll_speed = 0.5;
                    mroot.style.display = 'grid';
                    mroot.style.gridTemplateColumns = 'repeat(4, 88px)';
                    if (displayedItems.length > 30) {
                        mroot.style.top = '100px';
                    }

                    items.forEach(async entry => {
                        const filename = entry.textContent;
                        entry.classList.add('image-entry');
                        entry.setAttribute('title', filename);
                        
                        let thumbnailUrl = await getThumbnail(filename);
                        if (!thumbnailUrl) {
                            thumbnailUrl = await createThumbnail(filename);
                            await saveThumbnail(filename, thumbnailUrl);
                        }

                        entry.style.backgroundImage = `url('${thumbnailUrl}')`;
                    });
                }
            }

            return ctx;
        };

        LiteGraph.ContextMenu.prototype = ctxMenu.prototype;
    },
}

app.registerExtension(ext);
