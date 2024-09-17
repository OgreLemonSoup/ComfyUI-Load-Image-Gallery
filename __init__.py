import os
from server import PromptServer
from aiohttp import web
from folder_paths import get_input_directory

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

        input_dir = get_input_directory()
        file_path = os.path.join(input_dir, filename)

        if not os.path.exists(file_path):
            return web.Response(status=404, text="File not found")

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

NODE_CLASS_MAPPINGS = {}
WEB_DIRECTORY = "./js"
__all__ = ['NODE_CLASS_MAPPINGS', 'WEB_DIRECTORY']
