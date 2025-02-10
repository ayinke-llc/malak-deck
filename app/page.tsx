'use client';

import { useState } from "react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  RiArrowLeftSLine, 
  RiArrowRightSLine, 
  RiDownloadLine, 
  RiAddLine, 
  RiSubtractLine 
} from '@remixicon/react';

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
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Thumbnails */}
      <aside className="w-[240px] border-r flex flex-col">
        {/* Document Title */}
        <div className="p-4 border-b">
          <h1 className="font-medium truncate">Document.pdf</h1>
        </div>
        
        {/* Thumbnails Container */}
        <div className="flex-1 overflow-y-auto">
          {numPages > 0 && [...Array(numPages)].map((_, index) => (
            <div 
              key={index}
              className={`p-4 hover:bg-accent cursor-pointer border-b
                ${pageNumber === index + 1 ? 'bg-accent' : ''}`}
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
              <span className="text-sm text-muted-foreground">Page {index + 1}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-14 border-b px-4 flex items-center justify-between">
          {/* Left Controls */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
            >
              <RiArrowLeftSLine className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
            >
              <RiArrowRightSLine className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="mx-2 h-6" />
            <div className="flex items-center space-x-2">
              <Input
                type="number"
                value={pageNumber}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (value && value > 0 && value <= numPages) {
                    setPageNumber(value);
                  }
                }}
                className="w-16 h-8"
              />
              <span className="text-muted-foreground">of {numPages}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => changeScale(-0.1)}
              >
                <RiSubtractLine className="h-4 w-4" />
              </Button>
              <span className="w-16 text-center">{Math.round(scale * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => changeScale(0.1)}
              >
                <RiAddLine className="h-4 w-4" />
              </Button>
            </div>
            <Separator orientation="vertical" className="mx-2 h-6" />
            <Button variant="ghost" size="icon" asChild>
              <a href={pdfUrl} download>
                <RiDownloadLine className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* PDF Viewer Area */}
        <div className="flex-1 overflow-auto bg-muted/50 p-8">
          <div className="max-w-4xl mx-auto">
            {error ? (
              <div className="flex items-center justify-center h-[800px] text-destructive">
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
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
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
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
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
