'use client';

import { useState } from "react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker correctly
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Define options outside component for better performance
const options = {
  //cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts`
};

export default function Home() {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);
  
  // Sample PDF URL - replace with your PDF
  const pdfUrl = 'https://s22.q4cdn.com/959853165/files/doc_financials/2024/ar/Netflix-10-K-01272025.pdf';

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    setError('Error loading PDF. Please try again later.');
  }

  function changePage(offset: number) {
    setPageNumber(prevPageNumber => Math.min(Math.max(1, prevPageNumber + offset), numPages));
  }

  function changeScale(delta: number) {
    setScale(prevScale => Math.min(Math.max(0.5, prevScale + delta), 2.0));
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Left Sidebar - Thumbnails */}
      <aside className="w-[240px] border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Document Title */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="font-medium truncate">Document.pdf</h1>
        </div>
        
        {/* Thumbnails Container */}
        <div className="flex-1 overflow-y-auto">
          {numPages > 0 && [...Array(numPages)].map((_, index) => (
            <div 
              key={index}
              className={`p-4 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-200 dark:border-gray-800 
                ${pageNumber === index + 1 ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
              onClick={() => setPageNumber(index + 1)}
            >
              <Document 
                file={pdfUrl} 
                loading={null}
                onLoadError={onDocumentLoadError}
              >
                <Page 
                  pageNumber={index + 1} 
                  width={200}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
              <span className="text-sm text-gray-600 dark:text-gray-400">Page {index + 1}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-14 border-b border-gray-200 dark:border-gray-800 px-4 flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center space-x-4">
            <button 
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <input 
                type="text" 
                className="w-12 bg-transparent text-center" 
                value={pageNumber}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value && value > 0 && value <= numPages) {
                    setPageNumber(value);
                  }
                }}
              />
              <span className="text-gray-500 dark:text-gray-400 px-1">/</span>
              <span className="text-gray-500 dark:text-gray-400 pr-2">{numPages}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-2">
              <button 
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                onClick={() => changeScale(-0.1)}
              >−</button>
              <span className="px-2 text-sm">{Math.round(scale * 100)}%</span>
              <button 
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                onClick={() => changeScale(0.1)}
              >+</button>
            </div>
            <a 
              href={pdfUrl} 
              download
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          </div>
        </div>

        {/* PDF Viewer Area */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-8">
          <div className="max-w-4xl mx-auto">
            {error ? (
              <div className="flex items-center justify-center h-[800px] text-red-500">
                {error}
              </div>
            ) : (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                options={options}
                loading={
                  <div className="flex items-center justify-center h-[800px]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
                  </div>
                }
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale}
                  className="shadow-lg"
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  loading={
                    <div className="flex items-center justify-center h-[800px]">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white"></div>
                    </div>
                  }
                />
              </Document>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
