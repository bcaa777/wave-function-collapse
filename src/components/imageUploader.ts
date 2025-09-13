import getImageData from "../getImageData";
import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { inputGroup } from "./common";

interface IComponentImageUploader extends IComponent {
  onUploadComplete?: (image: ImageData) => void;
  getCurrentImage(): ImageData | null;
  clear(): void;
}

export function createImageUploader(): IComponentImageUploader {
  const component: IComponentImageUploader = {
    domElement: Object.assign(document.createElement("div"), { className: "imageUploaderComponent" }),
    getCurrentImage: () => currentImageData,
    clear: () => {
      // Clear the file input
      fileInput.value = '';
      // Clear the preview
      previewImage.src = '';
      previewImage.style.display = 'none';
      // Clear stored image data
      currentImageData = null;
      // Disable the use button
      useImageButton.disabled = true;
      // Clear any status message
      statusMessage.textContent = '';
      statusMessage.style.display = 'none';
    }
  };

  // Current uploaded image data
  let currentImageData: ImageData | null = null;

  // Create UI elements
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.marginBottom = "10px";

  const previewImage = document.createElement("img");
  previewImage.className = "uploadPreview";
  previewImage.style.display = "none";
  previewImage.style.maxWidth = "300px";
  previewImage.style.maxHeight = "300px";
  previewImage.style.border = "1px solid #ccc";
  previewImage.style.marginTop = "10px";

  const statusMessage = document.createElement("p");
  statusMessage.style.display = "none";
  statusMessage.style.marginTop = "10px";
  statusMessage.style.padding = "8px";
  statusMessage.style.borderRadius = "4px";

  const useImageButton = document.createElement("input");
  useImageButton.type = "button";
  useImageButton.value = "Use This Map";
  useImageButton.disabled = true;
  useImageButton.style.marginTop = "10px";
  useImageButton.onclick = () => {
    if (currentImageData && component.onUploadComplete) {
      component.onUploadComplete(currentImageData);
    }
  };

  const clearButton = document.createElement("input");
  clearButton.type = "button";
  clearButton.value = "Clear";
  clearButton.style.marginTop = "10px";
  clearButton.onclick = component.clear;

  // File input change handler
  fileInput.onchange = async () => {
    if (!fileInput.files || fileInput.files.length === 0) {
      return;
    }

    const file = fileInput.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showStatusMessage('Please select a valid image file.', 'error');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      showStatusMessage('File size too large. Please select an image smaller than 10MB.', 'error');
      return;
    }

    try {
      showStatusMessage('Processing image...', 'info');

      // Create object URL for preview
      const objectUrl = URL.createObjectURL(file);

      // Load image data using existing utility
      const imageData = await getImageData(objectUrl);

      // Check dimensions (reasonable limits for dungeon maps)
      const maxDimension = 256;
      if (imageData.width > maxDimension || imageData.height > maxDimension) {
        showStatusMessage(`Image dimensions too large. Please use an image no larger than ${maxDimension}x${maxDimension} pixels.`, 'error');
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // Success - store image data and update UI
      currentImageData = imageData;
      previewImage.src = objectUrl;
      previewImage.style.display = '';
      useImageButton.disabled = false;

      showStatusMessage(`Image loaded successfully: ${imageData.width}x${imageData.height} pixels`, 'success');

      // Clean up object URL after image loads
      previewImage.onload = () => {
        URL.revokeObjectURL(objectUrl);
      };

    } catch (error) {
      console.error('Error loading image:', error);
      showStatusMessage('Error loading image. Please try a different file.', 'error');
    }
  };

  function showStatusMessage(message: string, type: 'success' | 'error' | 'info') {
    statusMessage.textContent = message;
    statusMessage.style.display = 'block';

    // Remove existing classes
    statusMessage.classList.remove('status-success', 'status-error', 'status-info');

    // Add appropriate class for styling
    statusMessage.classList.add(`status-${type}`);

    // Style based on type
    switch (type) {
      case 'success':
        statusMessage.style.backgroundColor = '#d4edda';
        statusMessage.style.color = '#155724';
        statusMessage.style.border = '1px solid #c3e6cb';
        break;
      case 'error':
        statusMessage.style.backgroundColor = '#f8d7da';
        statusMessage.style.color = '#721c24';
        statusMessage.style.border = '1px solid #f5c6cb';
        break;
      case 'info':
        statusMessage.style.backgroundColor = '#d1ecf1';
        statusMessage.style.color = '#0c5460';
        statusMessage.style.border = '1px solid #bee5eb';
        break;
    }
  }

  // Build the component DOM
  buildDomTree(component.domElement, [
    document.createElement("p"), [
      "Upload an existing map image to use directly as a dungeon. The image should be a simple pixel art map with distinct colors representing different terrain types."
    ],
    inputGroup(), [
      document.createElement("label"), [
        "Select Image File: ", fileInput
      ]
    ],
    statusMessage,
    previewImage,
    inputGroup(), [
      useImageButton,
      clearButton
    ]
  ]);

  return component;
}

