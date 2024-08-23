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
                    resolve(canvas.toDataURL());
                };
                img.src = `http://${location.host}/view?filename=${encodeURIComponent(file)}&type=input`;
            });
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
					if (displayedItems.length > 30) {
						this.root.style.top = '100px';
					}

					items.forEach(async entry => {
						const filename = entry.textContent;
						entry.classList.add('image-entry');
						entry.setAttribute('title', filename);
						
						let thumbnailUrl = localStorage.getItem(`thumbnail_${filename}`);
						if (!thumbnailUrl) {
							thumbnailUrl = await createThumbnail(filename);
							localStorage.setItem(`thumbnail_${filename}`, thumbnailUrl);
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
