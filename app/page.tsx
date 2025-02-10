'use client';

import { useState, useEffect } from "react";
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
  RiSubtractLine,
  RiFullscreenLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine
} from '@remixicon/react';
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [scale, setScale] = useState<number>(2.5);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);
  
  const pdfUrl = 'https://s22.q4cdn.com/959853165/files/doc_financials/2024/ar/Netflix-10-K-01272025.pdf';

  useEffect(() => {
    const downloadPDF = async () => {
      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Failed to download PDF');
        
        // Get the total size of the file
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        // Create a new response with a custom reader to track progress
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let receivedLength = 0;

        // Read the stream
        while(true && reader) {
          const {done, value} = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          receivedLength += value.length;
          
          // Calculate and set progress
          if (total) {
            setDownloadProgress((receivedLength / total) * 100);
          }
        }

        // Combine all chunks into a single Uint8Array
        const chunksAll = new Uint8Array(receivedLength);
        let position = 0;
        for(const chunk of chunks) {
          chunksAll.set(chunk, position);
          position += chunk.length;
        }
        
        const blob = new Blob([chunksAll], { type: 'application/pdf' });
        setPdfBlob(blob);
        setError(null);
      } catch (err) {
        console.error('Error downloading PDF:', err);
        setError('Error downloading PDF. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    downloadPDF();
  }, [pdfUrl]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        changePage(1);
      } else if (e.key === 'ArrowLeft') {
        changePage(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, pageNumber]); // Dependencies needed for changePage logic

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

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 w-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <div className="w-full bg-muted rounded-full h-2.5 dark:bg-muted">
            <div 
              className="bg-primary h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
          <p className="text-muted-foreground">
            Downloading PDF... {downloadProgress.toFixed(0)}%
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Thumbnails */}
      <aside className={`${showPreview ? 'w-[240px]' : 'w-0'} border-r flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className="flex-1 overflow-y-auto">
          {numPages > 0 && [...Array(numPages)].map((_, index) => (
            <div 
              key={index}
              className={`p-4 hover:bg-accent cursor-pointer border-b
                ${pageNumber === index + 1 ? 'bg-accent' : ''}`}
              onClick={() => setPageNumber(index + 1)}
            >
              <Document 
                file={pdfBlob} 
                loading={
                  <div className="space-y-2">
                    <Skeleton className="h-[282px] w-[200px]" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                }
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
              onClick={() => setShowPreview(!showPreview)}
              className="mr-2"
            >
              {showPreview ? (
                <RiMenuFoldLine className="h-4 w-4" />
              ) : (
                <RiMenuUnfoldLine className="h-4 w-4" />
              )}
            </Button>
            <Separator orientation="vertical" className="mx-2 h-6" />
            <h1 className="font-medium text-sm">Document.pdf</h1>
            <Separator orientation="vertical" className="mx-2 h-6" />
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
            <Button variant="ghost" size="icon" asChild>
              <a href={pdfUrl} download>
                <RiDownloadLine className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
            >
              <RiFullscreenLine className="h-4 w-4" />
            </Button>
            <ThemeSwitcher />
          </div>
        </div>

        {/* PDF Viewer Area */}
        <div className="flex-1 overflow-auto bg-muted/50 relative flex flex-col">
          <div className="flex-1 w-full flex items-center justify-center p-4 pb-16">
            {error ? (
              <div className="flex items-center justify-center h-[800px] text-destructive">
                {error}
              </div>
            ) : (
              <div className="relative flex items-center gap-4">
                {/* Left Arrow */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative bg-background/90 hover:bg-background shadow-lg hover:shadow-xl backdrop-blur-sm z-10 h-24 w-24 rounded-full flex-shrink-0 transition-all duration-200 border-2 border-border hover:border-primary"
                  onClick={() => changePage(-1)}
                  disabled={pageNumber <= 1}
                >
                  <RiArrowLeftSLine className="h-12 w-12 text-foreground/80 hover:text-primary" />
                </Button>

                <div className="flex justify-center">
                  <Document
                    file={pdfBlob}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    options={options}
                    loading={
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                      </div>
                    }
                    className="flex justify-center"
                  >
                    <Page 
                      pageNumber={pageNumber} 
                      scale={scale}
                      className="shadow-lg"
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                        </div>
                      }
                    />
                  </Document>
                </div>

                {/* Right Arrow */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative bg-background/90 hover:bg-background shadow-lg hover:shadow-xl backdrop-blur-sm z-10 h-24 w-24 rounded-full flex-shrink-0 transition-all duration-200 border-2 border-border hover:border-primary"
                  onClick={() => changePage(1)}
                  disabled={pageNumber >= numPages}
                >
                  <RiArrowRightSLine className="h-12 w-12 text-foreground/80 hover:text-primary" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Reading Progress Bar - Add this before the footer */}
          {numPages > 0 && (
            <div className="sticky bottom-[49px] w-full h-1 bg-muted">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(pageNumber / numPages) * 100}%` }}
              />
            </div>
          )}
          
          {/* Footer */}
          <footer className="sticky bottom-0 left-0 right-0 p-2 bg-background/80 backdrop-blur-sm border-t flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Powered by Malak</span>
              {numPages > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                  {((pageNumber / numPages) * 100).toFixed(0)}% complete
                </span>
              )}
            </div>
            <div className="flex gap-4">
              <a href="/terms" className="hover:text-foreground">Terms & Conditions</a>
              <a href="/privacy" className="hover:text-foreground">Privacy Policy</a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
