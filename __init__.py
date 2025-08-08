import os
import base64
from PIL import Image
from urllib.parse import unquote
from server import PromptServer
from aiohttp import web
import folder_paths
from nodes import LoadImage

try:
    from nodes import LoadImageMask
    HAS_LOAD_IMAGE_MASK = True
except ImportError:
    HAS_LOAD_IMAGE_MASK = False

try:
    from nodes import LoadImageOutput
    HAS_LOAD_IMAGE_OUTPUT = True
except ImportError:
    HAS_LOAD_IMAGE_OUTPUT = False
    
# Save the original INPUT_TYPES method
original_input_types = {
    "LoadImage": LoadImage.INPUT_TYPES
}

if HAS_LOAD_IMAGE_MASK:
    original_input_types["LoadImageMask"] = LoadImageMask.INPUT_TYPES

if HAS_LOAD_IMAGE_OUTPUT:
    original_input_types["LoadImageOutput"] = LoadImageOutput.INPUT_TYPES

# Path to the thumbnails directory
THUMBNAILS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "thumbnails")
if not os.path.exists(THUMBNAILS_DIR):
    os.makedirs(THUMBNAILS_DIR)

# Get safe filename for thumbnail
def get_thumbnail_path(filename):
    safe_filename = filename.replace(os.sep, "__").replace("/", "__").replace("\\", "__").replace(" ", "_")
    return os.path.join(THUMBNAILS_DIR, f"{safe_filename}.webp")

# Create thumbnail from image file
def create_thumbnail(file_path, dir_type="input", size=(80, 80), is_output=False):
    try:
        # Skip non-image files and handle None paths
        if not file_path or not os.path.exists(file_path):
            return None
            
        # Check if it's actually an image file
        try:
            with Image.open(file_path) as img:
                img.verify()
        except Exception:
            # Not a valid image file
            return None
            
        # Re-open for actual processing
        img = Image.open(file_path)
        
        # Handle different image modes
        if img.mode in ('RGBA', 'LA', 'P'):
            # Convert to RGB for consistent handling
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        # Calculate aspect ratio
        width, height = img.size
        aspect_ratio = width / height

        # Crop to square from center
        if aspect_ratio > 1:
            new_width = height
            left = (width - new_width) // 2
            img = img.crop((left, 0, left + new_width, height))
        else:
            new_height = width
            top = (height - new_height) // 2
            img = img.crop((0, top, width, top + new_height))

        # Resize to thumbnail size
        img = img.resize(size, Image.LANCZOS)

        # Save as WebP
        try:
            if is_output:
                # For output files, we store thumbnails with a prefix to avoid conflicts
                rel_path = os.path.relpath(file_path, folder_paths.get_output_directory())
                thumbnail_path = get_thumbnail_path(f"OP_{rel_path}")
            else:
                rel_path = os.path.relpath(file_path, folder_paths.get_input_directory())
                thumbnail_path = get_thumbnail_path(rel_path)
                
            # Ensure directory exists
            os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
            img.save(thumbnail_path, "WEBP", quality=80)
            return thumbnail_path
        except Exception as e:
            print(f"Error saving thumbnail for {file_path}: {str(e)}")
            return None
            
    except Exception as e:
        print(f"Error creating thumbnail for {file_path}: {str(e)}")
        return None

def get_enhanced_files(input_dir_type="input"):
    """Get enhanced files from either input or output directory"""
    if input_dir_type == "input":
        base_dir = folder_paths.get_input_directory()
    elif input_dir_type == "output":
        base_dir = folder_paths.get_output_directory()
    else:
        return []
        
    exclude_folders = ["clipspace", "3d", "audio"]  # Add more protected folders
    additional_files = []

    for root, dirs, files in os.walk(base_dir, followlinks=True):
        # Skip protected folders
        dirs[:] = [d for d in dirs if d not in exclude_folders]
        
        # Check if current directory should be excluded
        if root != base_dir:  # Only check subdirectories, not the base directory itself
            rel_path = os.path.relpath(root, base_dir)
            parts = rel_path.split(os.sep)

            # Check if any part is in exclude list
            if any(part in exclude_folders for part in parts):
                continue

        for file in files:
            # Filter for image files only - skip video files explicitly
            if not folder_paths.filter_files_content_types([file], ["image"]):
                continue
                
            # Skip video files regardless of MIME detection
            video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v'}
            if any(file.lower().endswith(ext) for ext in video_extensions):
                continue

            file_path = os.path.join(root, file)
            
            # Make sure file_path is valid
            if not os.path.exists(file_path) or not os.path.isfile(file_path):
                continue
                
            rel_file_path = os.path.relpath(file_path, base_dir)
            
            # Add prefix to distinguish input and output files
            if input_dir_type == "output":
                prefixed_path = f"[output]/{rel_file_path}"
            else:
                prefixed_path = rel_file_path

            additional_files.append(prefixed_path)

            # For thumbnail creation, we need to ensure unique names for input/output files
            if input_dir_type == "output":
                # Use a special naming convention for output thumbnails to avoid conflicts
                thumbnail_path = get_thumbnail_path(f"OP_{rel_file_path}")
            else:
                thumbnail_path = get_thumbnail_path(rel_file_path)
                
            if not os.path.exists(thumbnail_path) and os.path.exists(file_path):
                try:
                    thumbnail_result = create_thumbnail(file_path, input_dir_type, is_output=(input_dir_type == "output"))
                    if thumbnail_result:
                        print(f"Generated thumbnail: {thumbnail_result}")
                    else:
                        print(f"Failed to generate thumbnail for: {file_path}")
                except Exception as e:
                    print(f"Thumbnail generation error for {file_path}: {str(e)}")
    return sorted(additional_files)

@classmethod
def enhanced_load_image_input_types(cls):
    original_result = original_input_types["LoadImage"]()
    original_files = original_result["required"]["image"][0]
    additional_files = get_enhanced_files("input")
    
    # Combine files and remove duplicates while preserving order
    combined_files = list(dict.fromkeys(original_files + additional_files))
    original_result["required"]["image"] = (combined_files, original_result["required"]["image"][1])
    return original_result

LoadImage.INPUT_TYPES = enhanced_load_image_input_types

if HAS_LOAD_IMAGE_MASK:
    @classmethod
    def enhanced_load_image_mask_input_types(cls):
        original_result = original_input_types["LoadImageMask"]()
        if "required" in original_result and "image" in original_result["required"]:
            param_name = "image"
        elif "required" in original_result and "mask" in original_result["required"]:
            param_name = "mask"
        else:
            return original_result
        
        original_files = original_result["required"][param_name][0]
        additional_files = get_enhanced_files()
        
        if isinstance(original_files, list):
            # Combine files and remove duplicates while preserving order
            combined_files = list(dict.fromkeys(original_files + additional_files))
            original_result["required"][param_name] = (combined_files, original_result["required"][param_name][1])
        
        return original_result
    
    LoadImageMask.INPUT_TYPES = enhanced_load_image_mask_input_types

if HAS_LOAD_IMAGE_OUTPUT:
    @classmethod
    def enhanced_load_image_output_input_types(cls):
        original_result = original_input_types["LoadImageOutput"]()
        if "required" in original_result and "image" in original_result["required"]:
            param_name = "image"
        else:
            return original_result
        
        original_files = original_result["required"][param_name][0]
        # Get files from output directory
        additional_files = get_enhanced_files("output")
        
        if isinstance(original_files, list):
            # Combine files and remove duplicates while preserving order
            combined_files = list(dict.fromkeys(original_files + additional_files))
            original_result["required"][param_name] = (combined_files, original_result["required"][param_name][1])
        elif isinstance(original_files, str):
            # print(f"Warning: original_files for {param_name} is a string, not a list")
            original_result["required"][param_name] = (original_files, original_result["required"][param_name][1])
        
        return original_result
    
    LoadImageOutput.INPUT_TYPES = enhanced_load_image_output_input_types


try:
    from send2trash import send2trash
    USE_SEND2TRASH = True
except ImportError:
    USE_SEND2TRASH = False

@PromptServer.instance.routes.post("/delete_file")
async def delete_file(request):
    try:
        data = await request.json()
        filename = data.get('filename')
        if not filename:
            return web.Response(status=400, text="Filename not provided")

        # Handle different path formats for output files
        file_path = None
        thumbnail_path = None
        
        # Normalize the filename for path handling
        filename = str(filename).replace('\\', '/')
        
        # Handle [output]/ prefix format
        if filename.startswith('[output]/'):
            rel_path = filename[9:]  # Remove "[output]/" prefix
            base_dir = folder_paths.get_output_directory()
            file_path = os.path.join(base_dir, rel_path)
            thumbnail_path = get_thumbnail_path(f"OP_{rel_path}")
        # Handle output/ prefix format (some nodes use this)
        elif filename.startswith('output/'):
            rel_path = filename[7:]  # Remove "output/" prefix
            base_dir = folder_paths.get_output_directory()
            file_path = os.path.join(base_dir, rel_path)
            thumbnail_path = get_thumbnail_path(f"OP_{rel_path}")
        # Handle direct paths (relative to base directories)
        else:
            # Check if it's in output directory
            output_file = os.path.join(folder_paths.get_output_directory(), filename)
            if os.path.exists(output_file):
                file_path = output_file
                thumbnail_path = get_thumbnail_path(f"OP_{filename}")
            else:
                # Assume input directory
                base_dir = folder_paths.get_input_directory()
                file_path = os.path.join(base_dir, filename)
                thumbnail_path = get_thumbnail_path(filename)
            
        if not os.path.exists(file_path):
            print(f"Delete error: File not found - {file_path}")
            return web.Response(status=404, text=f"File not found: {file_path}")
        
        print(f"Attempting to delete: {file_path}")
        print(f"Thumbnail path to delete: {thumbnail_path}")

        if os.path.exists(thumbnail_path):
            os.remove(thumbnail_path)

        if USE_SEND2TRASH:
            send2trash(file_path)
            message = "File moved to trash successfully"
        else:
            os.remove(file_path)
            message = "File deleted successfully"

        return web.Response(status=200, text=message)
    except Exception as e:
        print(f"Error deleting file: {str(e)}")
        return web.Response(status=500, text="Internal server error")

@PromptServer.instance.routes.get("/get_thumbnail/{filename:.*}")
async def get_thumbnail(request):
    try:
        filename = request.match_info['filename']
        
        # Handle URL decoding for special characters
        try:
            filename = unquote(filename)
        except:
            pass
            
        # Clean the filename - remove any leading slashes or path traversal
        filename = filename.lstrip('/')
        
        # First check if we have a thumbnail for this exact filename
        thumbnail_path = get_thumbnail_path(filename)
        
        # If not found, check if the original file exists
        if not os.path.exists(thumbnail_path):
            # Check both input and output directories
            thumbnail_created = False
            
            # Check input directory
            input_file = os.path.join(folder_paths.get_input_directory(), filename)
            if os.path.exists(input_file) and os.path.isfile(input_file):
                # Create thumbnail for input file
                new_thumbnail_path = create_thumbnail(input_file, "input")
                if new_thumbnail_path and os.path.exists(new_thumbnail_path):
                    thumbnail_path = new_thumbnail_path
                    thumbnail_created = True
            
            if not thumbnail_created:
                # Check output directory - these use OP_ prefix
                output_file = os.path.join(folder_paths.get_output_directory(), filename)
                if os.path.exists(output_file) and os.path.isfile(output_file):
                    # Use OP_ prefix for output files
                    op_thumbnail_path = get_thumbnail_path(f"OP_{filename}")
                    if not os.path.exists(op_thumbnail_path):
                        new_thumbnail_path = create_thumbnail(output_file, "output", is_output=True)
                        if new_thumbnail_path and os.path.exists(new_thumbnail_path):
                            thumbnail_path = new_thumbnail_path
                            thumbnail_created = True
                        else:
                            thumbnail_path = op_thumbnail_path
                    else:
                        thumbnail_path = op_thumbnail_path
                        thumbnail_created = True
                else:
                    # Handle nested paths with __ as path separator
                    nested_input = os.path.join(folder_paths.get_input_directory(), filename.replace("__", os.sep))
                    nested_output = os.path.join(folder_paths.get_output_directory(), filename.replace("__", os.sep))
                    
                    if os.path.exists(nested_input) and os.path.isfile(nested_input):
                        new_thumbnail_path = create_thumbnail(nested_input, "input")
                        if new_thumbnail_path and os.path.exists(new_thumbnail_path):
                            thumbnail_path = new_thumbnail_path
                            thumbnail_created = True
                    elif os.path.exists(nested_output) and os.path.isfile(nested_output):
                        op_thumbnail_path = get_thumbnail_path(f"OP_{filename.replace('__', '__')}")
                        if not os.path.exists(op_thumbnail_path):
                            new_thumbnail_path = create_thumbnail(nested_output, "output", is_output=True)
                            if new_thumbnail_path and os.path.exists(new_thumbnail_path):
                                thumbnail_path = new_thumbnail_path
                                thumbnail_created = True
                            else:
                                thumbnail_path = op_thumbnail_path
                        else:
                            thumbnail_path = op_thumbnail_path
                            thumbnail_created = True

        if not os.path.exists(thumbnail_path):
            # Return a placeholder if thumbnail creation fails
            from PIL import Image, ImageDraw
            placeholder = Image.new('RGB', (80, 80), color='lightgray')
            draw = ImageDraw.Draw(placeholder)
            draw.text((25, 35), "No Image", fill='darkgray')
            
            placeholder_path = os.path.join(THUMBNAILS_DIR, "placeholder.webp")
            placeholder.save(placeholder_path, "WEBP", quality=80)
            return web.FileResponse(placeholder_path)

        return web.FileResponse(thumbnail_path)
    except Exception as e:
        print(f"Error getting thumbnail for {filename}: {str(e)}")
        return web.Response(status=500, text="Internal server error")

@PromptServer.instance.routes.post("/get_thumbnails_batch")
async def get_thumbnails_batch(request):
    try:
        data = await request.json()
        filenames = data.get('filenames', [])

        if not filenames:
            return web.json_response({})

        result = {}
        input_dir = folder_paths.get_input_directory()
        output_dir = folder_paths.get_output_directory()

        # Skip video files in batch processing
        video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v'}
        
        for filename in filenames:
            try:
                # Skip video files
                if any(filename.lower().endswith(ext) for ext in video_extensions):
                    continue
                    
                # Skip if not a valid image file
                if not any(filename.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif']):
                    continue

                thumbnail_path = None
                
                # Handle output files with prefix
                if filename.startswith('[output]/'):
                    # Handle [output]/path format
                    rel_path = filename[9:]  # Remove "[output]/" prefix
                    file_path = os.path.join(output_dir, rel_path)
                    thumbnail_path = get_thumbnail_path(f"OP_{rel_path}")
                    if not os.path.exists(thumbnail_path):
                        thumbnail_path = create_thumbnail(file_path, "output", is_output=True)
                else:
                    # Handle input files
                    file_path = os.path.join(input_dir, filename)
                    thumbnail_path = get_thumbnail_path(filename)
                    if not os.path.exists(thumbnail_path):
                        thumbnail_path = create_thumbnail(file_path, "input")

                if thumbnail_path and os.path.exists(thumbnail_path):
                    try:
                        with open(thumbnail_path, "rb") as f:
                            file_content = f.read()
                            base64_data = base64.b64encode(file_content).decode('utf-8')
                            result[filename] = f"data:image/webp;base64,{base64_data}"
                    except Exception as e:
                        print(f"Error reading thumbnail {thumbnail_path}: {str(e)}")
                        continue
                        
            except Exception as e:
                print(f"Error processing filename {filename}: {str(e)}")
                continue

        return web.json_response(result)
    except Exception as e:
        print(f"Error getting thumbnails batch: {str(e)}")
        return web.json_response({})

@PromptServer.instance.routes.post("/cleanup_thumbnails")
async def cleanup_thumbnails(request):
    try:
        data = await request.json()
        active_files = data.get('active_files', [])

        # Always return success without removing thumbnails
        # We'll handle stale thumbnail cleanup separately with a more intelligent approach
        return web.Response(status=200, text="Thumbnail cleanup skipped - using intelligent management")
    except Exception as e:
        print(f"Error in thumbnail cleanup: {str(e)}")
        return web.Response(status=500, text="Internal server error")

@PromptServer.instance.routes.get("/check_thumbnails_service")
async def check_thumbnails_service(request):
    try:
        # Check if thumbnails directory exists and is accessible
        if not os.path.exists(THUMBNAILS_DIR):
            os.makedirs(THUMBNAILS_DIR, exist_ok=True)
        
        # Check if we can access input and output directories
        input_dir = folder_paths.get_input_directory()
        output_dir = folder_paths.get_output_directory()
        
        if not os.path.exists(input_dir) and not os.path.exists(output_dir):
            return web.Response(status=503, text="Input/output directories not accessible")
        
        return web.Response(status=200, text="Thumbnails service is available")
    except Exception as e:
        print(f"Error checking thumbnails service: {str(e)}")
        return web.Response(status=500, text="Service check failed")

@PromptServer.instance.routes.post("/cleanup_stale_thumbnails")
async def cleanup_stale_thumbnails(request):
    try:
        data = await request.json()
        active_files = data.get('active_files', [])

        # Get all files from both input and output directories
        input_files = get_enhanced_files("input")
        output_files = get_enhanced_files("output")
        all_files = input_files + output_files
        
        # Get all thumbnail files
        thumbnails = [f for f in os.listdir(THUMBNAILS_DIR) if f.endswith('.webp')]
        removed_count = 0
        
        # Create a set of valid thumbnail paths
        valid_thumbnails = set()
        for file_path in all_files:
            # Handle output files with prefix
            if file_path.startswith('[output]/'):
                rel_path = file_path[9:]  # Remove "[output]/" prefix
                valid_thumbnails.add(get_thumbnail_path(f"OP_{rel_path}"))
            else:
                valid_thumbnails.add(get_thumbnail_path(file_path))
        
        # Remove stale thumbnails
        for thumbnail in thumbnails:
            thumbnail_full_path = os.path.join(THUMBNAILS_DIR, thumbnail)
            if thumbnail_full_path not in valid_thumbnails:
                try:
                    os.remove(thumbnail_full_path)
                    removed_count += 1
                except OSError:
                    pass  # Ignore errors when removing files
        
        return web.Response(status=200, text=f"Removed {removed_count} stale thumbnails")
    except Exception as e:
        print(f"Error cleaning up stale thumbnails: {str(e)}")
        return web.Response(status=500, text="Internal server error")

NODE_CLASS_MAPPINGS = {}
WEB_DIRECTORY = "./js"
__all__ = ['NODE_CLASS_MAPPINGS', 'WEB_DIRECTORY']