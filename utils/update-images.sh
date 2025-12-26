#!/bin/bash
# Auto-generate images.json manifest from all images in the images/ folder

cd "$(dirname "$0")/images"

# Create JSON array of all image files
echo "["
first=true
for img in *.{jpg,jpeg,png,gif,webp,JPG,JPEG,PNG,GIF,WEBP} 2>/dev/null; do
    # Skip if no files match (the glob pattern itself)
    if [ -f "$img" ]; then
        if [ "$first" = true ]; then
            echo "  \"$img\""
            first=false
        else
            echo "  ,\"$img\""
        fi
    fi
done
echo "]" > images.json

echo "✓ Updated images.json with $(grep -c "\"" images.json) images"
