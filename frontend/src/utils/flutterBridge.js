/**
 * Flutter InAppWebView JavaScript Bridge Utilities
 */

export const openFlutterCamera = async () => {
  // Check if we are running inside the Flutter InAppWebView
  if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
    try {
      const result = await window.flutter_inappwebview.callHandler('openCamera');
      if (result && result.success) {
        const mimeType = result.mimeType || 'image/jpeg';
        const base64 = result.base64;

        // Convert base64 to Blob
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Create File object
        const fileName = result.fileName || `camera_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: mimeType });

        // Add dataUrl for easy preview
        file.dataUrl = `data:${mimeType};base64,${base64}`;

        return file;
      }
    } catch (error) {
      console.error('Flutter Camera Bridge Error:', error);
    }
  }
  return null;
};

export const playFlutterSound = async (soundKey = 'notification') => {
  if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
    try {
      await window.flutter_inappwebview.callHandler('playSound', { sound: soundKey });
      return true;
    } catch (error) {
      console.error('Flutter Sound Bridge Error:', error);
    }
  }
  return false;
};

export const shareToFlutter = async (data) => {
  if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
    try {
      const result = await window.flutter_inappwebview.callHandler('shareContent', {
        title: data.title || 'Styling with Muskan',
        text: data.text || '',
        url: data.url || ''
      });
      if (result === true || (result && result.success)) {
        return true;
      }
    } catch (error) {
      console.error('Flutter Share Bridge Error:', error);
    }
  }

  // Fallback for custom Flutter webview implementations like webview_flutter 
  // or native iOS WKWebView that might inject standard message handlers
  if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.share) {
    try {
      window.webkit.messageHandlers.share.postMessage({
        title: data.title || 'Styling with Muskan',
        text: data.text || '',
        url: data.url || ''
      });
      return true;
    } catch (error) {
      console.error('WebKit Share Bridge Error:', error);
    }
  }

  // Fallback for Android JavascriptInterface if standard share is disabled
  if (window.AndroidInterface && window.AndroidInterface.share) {
    try {
      window.AndroidInterface.share(JSON.stringify({
        title: data.title || 'Styling with Muskan',
        text: data.text || '',
        url: data.url || ''
      }));
      return true;
    } catch (error) {
      console.error('Android Share Bridge Error:', error);
    }
  }
  
  return false;
};

export const isFlutterWebView = () => {
  // Check for standard InAppWebView or common custom interfaces
  return !!(
    (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) ||
    window.FlutterInterface ||
    navigator.userAgent.includes('Flutter')
  );
};
