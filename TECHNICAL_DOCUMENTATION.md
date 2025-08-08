# ComfyUI Load Image Gallery - Technical Documentation

## Project Overview

ComfyUI Load Image Gallery is a custom node extension that provides enhanced image loading functionality for ComfyUI, including thumbnail previews, file management, and directory navigation.

## System Architecture

### Core Components

#### 1. Server (Python)
- **File**: `__init__.py`
- **Function**: HTTP endpoints, thumbnail generation, file management
- **Tech Stack**: aiohttp, PIL/Pillow, Python 3.7+

#### 2. Client (JavaScript)
- **File**: `js/LoadImageGallery.js`
- **Function**: Thumbnail display, interactive interface, file operations
- **Tech Stack**: Native JavaScript, LiteGraph, ComfyUI API

## Directory Structure

```
ComfyUI-Load-Image-Gallery/
├── __init__.py              # Server main program
├── js/
│   └── LoadImageGallery.js  # Client script
├── thumbnails/              # Thumbnail cache directory
├── TECHNICAL_DOCUMENTATION.md   # This documentation
└── pyproject.toml           # Project configuration
```

## Server API Endpoints

### Thumbnail Services

#### 1. GET /get_thumbnail/{filename}
**Function**: Get thumbnail for a single image
**Parameters**: filename - URL-encoded image filename
**Response**: WebP thumbnail or placeholder image

**Path Mapping**:
- Input file: `input/filename.png` → `thumbnails/filename.png.webp`
- Output file: `output/filename.png` → `thumbnails/OP_filename.png.webp`

#### 2. POST /get_thumbnails_batch
**Function**: Get multiple thumbnails in batch
**Request Body**: `{filenames: ["file1.png", "file2.jpg"]}`
**Response**: Base64 encoded thumbnail data

#### 3. GET /check_thumbnails_service
**Function**: Check thumbnail service status
**Response**: 200 OK or 503 Service Unavailable

### File Management

#### 4. POST /delete_file
**Function**: Delete file and its thumbnail
**Request Body**: `{filename: "path/to/file.png"}`
**Response**: Success message or error information

#### 5. POST /cleanup_stale_thumbnails
**Function**: Clean up stale thumbnails
**Request Body**: `{active_files: ["file1.png", "file2.jpg"]}`
**Response**: Cleanup statistics

## Thumbnail Generation Mechanism

### Generation Process
1. **Input Validation**: Check file existence and image format compatibility
2. **Format Conversion**: Convert to RGB mode for consistency
3. **Size Processing**: Center crop to square format, resize to 80x80 pixels
4. **Format Optimization**: Save as WebP format with 80% quality

### Supported Image Formats
- PNG (.png)
- JPEG (.jpg, .jpeg)
- GIF (.gif)
- WebP (.webp)
- BMP (.bmp)
- TIFF (.tiff, .tif)

### Filtered File Types
- Video files: .mp4, .avi, .mov, .mkv, .wmv, .flv, .webm, .m4v
- System directories: clipspace, 3d, audio

## Frontend Integration

### Thumbnail Display
- **Caching Mechanism**: Use Map object to cache thumbnail URLs
- **Batch Loading**: Support batch preloading of thumbnails
- **Error Handling**: Provide placeholder images as fallback

### Interactive Features
- **Hover Tooltip**: Display full filename on hover
- **Delete Button**: Support file deletion operations
- **Directory Navigation**: Support folder hierarchy navigation
- **Responsive Layout**: Adaptive grid layout

## Configuration Parameters

### Thumbnail Settings
- **Size**: 80x80 pixels
- **Format**: WebP
- **Quality**: 80%
- **Storage Path**: `./thumbnails/`

### Excluded Directories
```python
exclude_folders = ["clipspace", "3d", "audio"]
```

## Troubleshooting

### Common Issues

#### 1. 404 Not Found Error
**Cause**: Thumbnail file does not exist or service endpoint is not properly configured
**Solution**: 
- Check if the file exists in the appropriate directory
- Confirm the service endpoint `/get_thumbnail/` is running correctly
- Restart ComfyUI to apply changes

#### 2. NoneType Path Error
**Cause**: File path is None or file does not exist
**Solution**: 
- Ensure file path is valid
- Check file permissions
- Verify file format support

#### 3. Thumbnails Not Displaying
**Cause**: File format not supported or file is corrupted
**Solution**:
- Confirm file format is in the supported list
- Check if file is corrupted
- View server logs for detailed information

### Debugging Methods

#### Check Service Status
```bash
curl http://localhost:8188/check_thumbnails_service
```

#### Test Single Thumbnail
```bash
curl http://localhost:8188/get_thumbnail/filename.png
```

#### View Server Logs
Check ComfyUI terminal output for error messages

## Performance Optimization

### Caching Strategy
- **Memory Cache**: Frontend uses Map to cache thumbnail URLs
- **Disk Cache**: Thumbnail files cached on local disk
- **Session Cache**: Use sessionStorage to reduce duplicate cleanup

### Batch Processing
- **Batch Loading**: Support loading multiple thumbnails at once
- **Async Processing**: Non-blocking thumbnail generation
- **Lazy Loading**: Generate thumbnails on demand

## Extension Development

### Adding New Image Formats
1. Modify format filtering in `get_enhanced_files()`
2. Update format support in `create_thumbnail()`
3. Test thumbnail generation for new format

### Custom Thumbnail Size
1. Modify size parameter in `create_thumbnail()`
2. Update frontend CSS styles
3. Adjust grid layout parameters

### Integrating New Storage Backend
1. Extend `get_thumbnail_path()` to support cloud storage
2. Modify server endpoint processing logic
3. Update caching strategy

## Version Compatibility

### ComfyUI Version Requirements
- ComfyUI 0.8.0+
- Python 3.7+
- aiohttp 3.8+
- Pillow 8.0+

### Dependency Installation
```bash
pip install pillow aiohttp send2trash
```

## Contribution Guidelines

### Development Environment Setup
1. Clone project to ComfyUI custom nodes directory
2. Install dependency packages
3. Restart ComfyUI
4. Test if functionality works correctly

### Code Standards
- Follow PEP 8 Python coding standards
- Use type annotations
- Add appropriate error handling
- Include unit tests

## License

MIT License - See LICENSE file in project root directory

## Technical Support

If you encounter issues, please check:
1. ComfyUI terminal logs
2. Browser developer tools console
3. The troubleshooting section of this technical documentation

---

*Last updated: 2025*