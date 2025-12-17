import React, { useState, useEffect } from 'react';


const PACKAGES = {
  test: { title: 'Test Package', limit: 2, description: 'Please upload 2 test images.', column: 'Image_Upload' },
  starter: { title: 'Starter Package', limit: 3, description: 'Please upload 3 images.', column: 'Image_Upload2' },
  normal: { title: 'Normal Package', limit: 8, description: 'Please upload 8 images.', column: 'Image_Upload2' },
  default: { title: 'Image Upload', limit: 10, description: 'Please upload your images.', column: 'Image_Upload2' }
};

function App() {
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [variationCount, setVariationCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchResults, setBatchResults] = useState([]);

  // Get package from URL query parameter
  const queryParams = new URLSearchParams(window.location.search);
  const packageType = queryParams.get('package');
  const queryEmail = queryParams.get('email');
  const currentPackage = PACKAGES[packageType] || PACKAGES.default;

  // If someone opens the page with ?email=..., redirect to the download page endpoint
  useEffect(() => {
    if (queryEmail) {
      const encoded = encodeURIComponent(queryEmail);
      window.location.href = `/get-download?email=${encoded}`;
    }
  }, [queryEmail]);

  const [selectedImageIndex, setSelectedImageIndex] = useState("");

  // Load images from R2 folder
  const loadImagesFromR2 = async () => {
    if (!email) {
      alert('Please enter your email');
      return;
    }

    setLoadingImages(true);
    try {
      // Call list-images endpoint
      const response = await fetch('/list-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to load images from R2');
      }

      const data = await response.json();

      if (data.images.length === 0) {
        alert('No images found in your folder. Please upload images first.');
        return;
      }

      // Convert R2 images to File objects
      const filePromises = data.images.map(async (img) => {
        const imgResponse = await fetch(img.url);
        const blob = await imgResponse.blob();

        // Ensure mime type is set correctly
        const mimeType = blob.type || img.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
          ? `image/${img.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)[1].replace('jpg', 'jpeg')}`
          : 'image/jpeg';

        const file = new File([blob], img.filename, { type: mimeType });
        console.log('📦 Created File:', { name: file.name, size: file.size, type: file.type });
        return file;
      });

      const loadedFiles = await Promise.all(filePromises);
      console.log(`✅ Loaded ${loadedFiles.length} files:`, loadedFiles.map(f => ({ name: f.name, type: f.type })));
      setFiles(loadedFiles);
      alert(`✅ Loaded ${loadedFiles.length} images from R2 folder`);

    } catch (error) {
      console.error('❌ Error loading images from R2:', error);
      alert('Failed to load images: ' + error.message);
    } finally {
      setLoadingImages(false);
    }
  };

  const generateImage = async () => {
    setIsLoading(true);
    try {
      const selectedFile = selectedImageIndex !== "" ? files[selectedImageIndex] : null;

      let body;
      let headers = {};

      if (!selectedFile) {
        alert("Please select an image to modify.");
        setIsLoading(false);
        return;
      }

      // Prompt is now optional - backend will use default if empty
      /*
      /*
      if (!prompt || prompt.trim() === '') {
        alert("Please enter a prompt to describe the modification.");
        setIsLoading(false);
        return;
      }
      */

      console.log('📤 Preparing to send:');
      console.log('  - Prompt:', prompt);
      console.log('  - Selected file:', selectedFile);
      console.log('  - File details:', {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type
      });

      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('image', selectedFile, selectedFile.name);
      formData.append('email', email);
      formData.append('count', variationCount);
      formData.append('user', 'Martin');

      console.log('📤 FormData created, sending to /ai...');
      body = formData;

      const response = await fetch('/ai', {
        method: 'POST',
        headers: headers, // Empty for FormData
        body: body,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const imageUrls = data.data || [];
      console.log("Gemini Response:", data);

      setResults(imageUrls);

      if (imageUrls.length === 0) throw new Error("No images returned from Gemini");

      // Save first image to Airtable
      const firstImageUrl = imageUrls[0]?.url;
      if (firstImageUrl) {
        await saveToAirtable(prompt, firstImageUrl, 'Martin', email, files, currentPackage.column);
      }

    } catch (error) {
      console.error("Error generating image:", error);
      alert(`Error generating image: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };


  // Modify all images with the same prompt
  const modifyAllImages = async () => {
    // Prompt is now optional
    /*
    if (!prompt || prompt.trim() === '') {
      alert("Please enter a prompt to describe the modification.");
      return;
    }
    */

    if (files.length === 0) {
      alert("No images loaded. Please load images first.");
      return;
    }

    setBatchProcessing(true);
    setBatchProgress({ current: 0, total: files.length });
    const allResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBatchProgress({ current: i + 1, total: files.length });

      try {
        console.log(`📤 Processing ${i + 1}/${files.length}: ${file.name}`);

        const formData = new FormData();
        formData.append('prompt', prompt);
        formData.append('image', file, file.name);
        formData.append('email', email);
        formData.append('count', variationCount);
        formData.append('user', 'Martin');

        const response = await fetch('/ai', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to process ${file.name}`);
        }

        const data = await response.json();
        const imageUrls = data.data || [];

        allResults.push({
          originalName: file.name,
          prompt: prompt,
          results: imageUrls,
        });

      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        allResults.push({
          originalName: file.name,
          prompt: prompt,
          error: error.message,
        });
      }
    }

    setBatchResults(allResults);
    setBatchProcessing(false);
    alert(`✅ Batch processing complete! Processed ${allResults.length} images.`);
  };


  const saveToAirtable = async (prompt, imageUrl, user = 'Anonymous', email = '', files = [], uploadColumn = 'Image_Upload2') => {
    console.log("📦 Saving to Airtable:", { prompt, imageUrl, user, email, files, uploadColumn });
    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('imageUrl', imageUrl);
      formData.append('user', user);
      formData.append('email', email);
      formData.append('uploadColumn', uploadColumn); // Send target column

      files.forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch('/airtable', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log("✅ Saved to Airtable:", result);
    } catch (error) {
      console.error("❌ Error saving to Airtable:", error);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>{currentPackage.title}</h1>
      <p>{currentPackage.description}</p>

      <div style={{ marginBottom: '2rem', border: '2px solid #4CAF50', padding: '1rem', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0 }}>Load Images from R2</h3>
        <input
          type="email"
          placeholder="Your Email (e.g., martin_wrede@web.de)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: '0.5rem', width: '300px', display: 'block', marginBottom: '0.5rem' }}
        />
        <button
          onClick={loadImagesFromR2}
          disabled={loadingImages || !email}
          style={{
            padding: '0.5rem 1rem',
            marginTop: '0.5rem',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: loadingImages || !email ? 'not-allowed' : 'pointer',
            opacity: loadingImages || !email ? 0.6 : 1
          }}
        >
          {loadingImages ? 'Loading...' : '📂 Find Folder'}
        </button>
        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', marginBottom: 0 }}>
          Will load images from R2 folder: <strong>{email ? email.replace(/[^a-zA-Z0-9]/g, '_') : 'your_email'}</strong>
        </p>
        {files.length > 0 && (
          <p style={{ fontSize: '0.9rem', color: '#4CAF50', marginTop: '0.5rem', marginBottom: 0 }}>
            ✅ {files.length} images loaded
          </p>
        )}
      </div>

      {/** AI image gneration starts here */}
      {/**  */}

      <hr style={{ margin: '2rem 0' }} />

      <h1>Generate or Modify Image with AI</h1>

      {files.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select an image to modify (Required):</label>
          <select
            onChange={(e) => setSelectedImageIndex(e.target.value)}
            value={selectedImageIndex}
            id="imageSelector"
            style={{ padding: '0.5rem', width: '300px' }}
          >
            <option value="">-- Select an image --</option>
            {files.map((file, index) => (
              <option key={index} value={index}>
                {file.name}
              </option>
            ))}
          </select>
          <p style={{ fontSize: '0.8rem', color: '#666' }}>
            * Select an uploaded image and enter a prompt to modify it.
          </p>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Number of variations:
        </label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="variationCount"
              value={1}
              checked={variationCount === 1}
              onChange={(e) => setVariationCount(parseInt(e.target.value))}
            />
            {' '}1 image (fast, cheaper)
          </label>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="variationCount"
              value={2}
              checked={variationCount === 2}
              onChange={(e) => setVariationCount(parseInt(e.target.value))}
            />
            {' '}2 variations
          </label>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="variationCount"
              value={4}
              checked={variationCount === 4}
              onChange={(e) => setVariationCount(parseInt(e.target.value))}
            />
            {' '}4 variations
          </label>
        </div>
      </div>

      <textarea
        placeholder="Enter your prompt (optional, default will be used)"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        disabled={selectedImageIndex === ""}
        rows={4}
        style={{
          padding: '0.5rem',
          width: '300px',
          backgroundColor: selectedImageIndex === "" ? '#f0f0f0' : 'white',
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          resize: 'vertical'
        }}
      />
      <button
        onClick={generateImage}
        disabled={isLoading}
        style={{ marginLeft: '1rem', padding: '0.5rem 1rem' }}
      >

        {isLoading ? 'Processing...' : 'Modify Image with Gemini'}
      </button>


      {files.length > 1 && (
        <button
          onClick={modifyAllImages}
          disabled={batchProcessing}
          style={{
            marginLeft: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            cursor: batchProcessing ? 'not-allowed' : 'pointer',
            opacity: batchProcessing ? 0.6 : 1
          }}
        >
          {batchProcessing
            ? `Processing ${batchProgress.current}/${batchProgress.total}...`
            : `🚀 Modify All ${files.length} Images`
          }
        </button>
      )}

      {/* Progress Bar for Batch Processing */}
      {batchProcessing && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{
            width: '100%',
            height: '25px',
            backgroundColor: '#f0f0f0',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(batchProgress.current / batchProgress.total) * 100}%`,
              height: '100%',
              backgroundColor: '#FF9800',
              transition: 'width 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.9rem'
            }}>
              {Math.round((batchProgress.current / batchProgress.total) * 100)}%
            </div>
          </div>
        </div>
      )}


      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Generated Image{results.length > 1 ? 's' : ''}:</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: results.length === 1 ? '1fr' : 'repeat(2, 1fr)',
            gap: '1rem',
            maxWidth: results.length === 1 ? '400px' : '800px'
          }}>
            {results.map((img, index) => (
              <div key={index} style={{ border: '2px solid #ccc', padding: '0.5rem' }}>
                <img
                  src={img.url}
                  alt={`Variation ${index + 1}`}
                  style={{ width: '100%', height: 'auto' }}
                />
                {results.length > 1 && (
                  <p style={{ textAlign: 'center', margin: '0.5rem 0 0 0' }}>
                    Variation {index + 1}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


      {/* Batch Results */}
      {batchResults.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h2>🎉 Batch Results ({batchResults.length} images processed)</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginTop: '1rem'
          }}>
            {batchResults.map((result, index) => (
              <div key={index} style={{
                border: '2px solid #FF9800',
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: '#fff'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#FF9800' }}>
                  {result.originalName}
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 0.5rem 0' }}>
                  Prompt: {result.prompt}
                </p>
                {result.error ? (
                  <p style={{ color: 'red', fontSize: '0.9rem' }}>❌ Error: {result.error}</p>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: result.results.length === 1 ? '1fr' : 'repeat(2, 1fr)',
                    gap: '0.5rem'
                  }}>
                    {result.results.map((img, imgIndex) => (
                      <div key={imgIndex}>
                        <img
                          src={img.url}
                          alt={`Result ${imgIndex + 1}`}
                          style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                        />
                        {result.results.length > 1 && (
                          <p style={{ fontSize: '0.7rem', textAlign: 'center', margin: '0.25rem 0 0 0' }}>
                            Variation {imgIndex + 1}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
}

export default App;