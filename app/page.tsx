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
  RiMenuUnfoldLine,
  RiQuestionLine
} from '@remixicon/react';
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from '@/hooks/use-media-query';  
import Shepherd from 'shepherd.js';
import type { Tour } from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

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
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);
  
  const pdfUrl = 'https://s22.q4cdn.com/959853165/files/doc_financials/2024/ar/Netflix-10-K-01272025.pdf';

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [scale, setScale] = useState<number>(1.0);

  const [tour, setTour] = useState<Tour | null>(null);
  
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

  // Update the scale calculation effect
  useEffect(() => {
    function updateScale() {
      const container = document.querySelector('.pdf-container');
      if (container && pdfBlob) {
        const containerWidth = container.clientWidth - (isMobile ? 32 : 160);
        const baseScale = containerWidth / 600;
        
        // Larger scale for desktop, smaller for mobile
        setScale(isMobile ? Math.min(baseScale, 0.8) : Math.min(baseScale, 2.0));
      }
    }

    window.addEventListener('resize', updateScale);
    updateScale();
    return () => window.removeEventListener('resize', updateScale);
  }, [isMobile, pdfBlob]);

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

  useEffect(() => {
    const newTour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'shadow-lg rounded-lg border bg-background text-foreground',
        modalOverlayOpeningPadding: 4,
        scrollTo: true,
        cancelIcon: {
          enabled: true
        },
        arrow: true,
        when: {
          show() {
            const content = document.querySelector('.shepherd-content');
            const text = document.querySelector('.shepherd-text');
            const footer = document.querySelector('.shepherd-footer');
            const buttons = document.querySelectorAll('.shepherd-button');
            
            if (content) content.classList.add('p-6');
            if (text) text.classList.add('mb-4', 'leading-normal');
            if (footer) footer.classList.add('flex', 'justify-end', 'gap-2');
            
            buttons.forEach(button => {
              button.classList.add(
                'inline-flex',
                'items-center',
                'justify-center',
                'rounded-md',
                'text-sm',
                'font-medium',
                'transition-colors',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-ring',
                'disabled:pointer-events-none',
                'disabled:opacity-50',
                'h-9',
                'px-4',
                'py-2'
              );
            });
            
            // Style primary button
            const nextButton = buttons[buttons.length - 1];
            if (nextButton) {
              nextButton.classList.add(
                'bg-primary',
                'text-primary-foreground',
                'hover:bg-primary/90'
              );
            }
            
            // Style back button
            const backButton = buttons[0];
            if (backButton && buttons.length > 1) {
              backButton.classList.add(
                'border',
                'border-input',
                'bg-background',
                'hover:bg-accent',
                'hover:text-accent-foreground'
              );
            }
          }
        }
      }
    });

    newTour.addSteps([
      {
        id: 'sidebar',
        text: 'Toggle the sidebar to view all pages in the document',
        attachTo: {
          element: '.sidebar-toggle',
          on: 'right'
        },
        buttons: [
          {
            text: 'Next',
            action: () => newTour.next()
          }
        ],
        beforeShowPromise: function() {
          return new Promise<void>(resolve => {
            if (document.querySelector('.sidebar-toggle')) {
              resolve();
            } else {
              const observer = new MutationObserver((mutations, obs) => {
                if (document.querySelector('.sidebar-toggle')) {
                  obs.disconnect();
                  resolve();
                }
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });

              // Timeout after 5 seconds to prevent infinite waiting
              setTimeout(() => {
                observer.disconnect();
                resolve();
              }, 5000);
            }
          });
        }
      },
      {
        id: 'navigation',
        text: 'Navigate through pages using these controls or your keyboard arrow keys',
        attachTo: {
          element: '.page-navigation',
          on: 'bottom'
        },
        buttons: [
          {
            text: 'Back',
            action: () => newTour.back()
          },
          {
            text: 'Next',
            action: () => newTour.next()
          }
        ]
      },
      {
        id: 'download',
        text: 'Download the document for offline viewing',
        attachTo: {
          element: '.download-button',
          on: 'bottom'
        },
        buttons: [
          {
            text: 'Back',
            action: () => newTour.back()
          },
          {
            text: 'Next',
            action: () => newTour.next()
          }
        ]
      },
      {
        id: 'fullscreen',
        text: 'Toggle fullscreen mode for a more immersive reading experience',
        attachTo: {
          element: '.fullscreen-button',
          on: 'bottom'
        },
        buttons: [
          {
            text: 'Back',
            action: () => newTour.back()
          },
          {
            text: 'Next',
            action: () => newTour.next()
          }
        ]
      },
      {
        id: 'theme',
        text: 'Switch between light and dark mode for comfortable reading',
        attachTo: {
          element: '.theme-switcher button',
          on: 'bottom'
        },
        buttons: [
          {
            text: 'Back',
            action: () => newTour.back()
          },
          {
            text: 'Next',
            action: () => newTour.next()
          }
        ]
      },
      {
        id: 'progress',
        text: 'Track your reading progress here',
        attachTo: {
          element: '.progress-bar',
          on: 'top'
        },
        buttons: [
          {
            text: 'Back',
            action: () => newTour.back()
          },
          {
            text: 'Done',
            action: () => newTour.complete()
          }
        ]
      }
    ]);

    setTour(newTour);
  }, []);

  useEffect(() => {
    if (tour && !localStorage.getItem('tourCompleted') && !isLoading && pdfBlob) {
      console.log('Tour conditions met, preparing to start tour');
      
      // Clear any existing tour state
      localStorage.removeItem('shepherd-tour');
      
      // Only start tour when PDF is loaded and elements are ready
      const startTour = () => {
        const elements = [
          '.sidebar-toggle',
          '.page-navigation',
          '.download-button',
          '.theme-switcher',
          '.progress-bar'
        ];
        
        // Check if all required elements are present
        const missingElements = elements.filter(selector => !document.querySelector(selector));
        
        if (missingElements.length === 0) {
          console.log('All elements present, starting tour');
          requestAnimationFrame(() => {
            tour.start();
          });
        } else {
          console.log('Missing elements:', missingElements);
          setTimeout(startTour, 200); // Increased retry interval
        }
      };
      
      // Start checking after the component has fully mounted
      setTimeout(startTour, 1000);
      
      tour.on('complete', () => {
        console.log('Tour completed');
        localStorage.setItem('tourCompleted', 'true');
      });
      
      tour.on('cancel', () => {
        console.log('Tour cancelled');
        localStorage.setItem('tourCompleted', 'true');
      });

      tour.on('start', () => {
        console.log('Tour started');
      });

      return () => {
        tour.complete();
      };
    }
  }, [tour, isLoading, pdfBlob]);

  // Function to manually start the tour
  const startTourManually = () => {
    console.log('Manual tour start requested');
    localStorage.removeItem('tourCompleted');
    localStorage.removeItem('shepherd-tour');
    if (tour) {
      requestAnimationFrame(() => {
        tour.start();
      });
    }
  };

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

  if (error || isLoading) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className={`${showPreview ? 'w-[240px] md:w-[240px]' : 'w-0'} border-r flex flex-col transition-all duration-300 overflow-hidden fixed md:relative z-20 bg-background h-full`}>
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

      <main className="flex-1 flex flex-col w-full overflow-hidden">
        <div className="h-12 md:h-14 border-b px-2 md:px-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPreview(!showPreview)}
              className="mr-2 flex-shrink-0 sidebar-toggle"
            >
              {showPreview ? (
                <RiMenuFoldLine className="h-4 w-4" />
              ) : (
                <RiMenuUnfoldLine className="h-4 w-4" />
              )}
            </Button>
            <Separator orientation="vertical" className="mx-2 h-6 hidden md:block" />
            <h1 className="font-medium text-sm truncate hidden md:block">Document.pdf</h1>
            <Separator orientation="vertical" className="mx-2 h-6" />
            <div className="flex items-center space-x-2 flex-shrink-0">
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
              <span className="text-muted-foreground whitespace-nowrap">of {numPages}</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 download-button"
            >
              <a 
                href={pdfUrl} 
                download 
                className="flex items-center justify-center"
              >
                <RiDownloadLine className="h-4 w-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="hidden md:inline-flex h-8 w-8 fullscreen-button"
            >
              <RiFullscreenLine className="h-4 w-4" />
            </Button>
            <div className="theme-switcher">
              <ThemeSwitcher />
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={startTourManually}
              className="h-8 w-8"
            >
              <RiQuestionLine className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 w-full flex items-center justify-center p-2 md:p-8 pb-16 pdf-container overflow-hidden">
          {error ? (
            <div className="flex items-center justify-center h-[800px] text-destructive">
              {error}
            </div>
          ) : (
            <div className="relative flex items-center gap-1 md:gap-8 w-full max-w-[1600px] mx-auto page-navigation">
              <Button
                variant="ghost"
                size="icon"
                className="relative bg-background/90 hover:bg-background shadow-lg hover:shadow-xl backdrop-blur-sm z-10 h-8 w-8 md:h-32 md:w-32 rounded-full flex-shrink-0 transition-all duration-200 border-2 border-border hover:border-primary"
                onClick={() => changePage(-1)}
                disabled={pageNumber <= 1}
              >
                <RiArrowLeftSLine className="h-4 w-4 md:h-16 md:w-16 text-foreground/80 hover:text-primary" />
              </Button>

              <div className="flex justify-center max-w-full overflow-hidden flex-1">
                <Document
                  file={pdfBlob}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  options={options}
                  loading={
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-primary" />
                    </div>
                  }
                  className="flex justify-center w-full max-w-5xl mx-auto"
                >
                  <Page 
                    pageNumber={pageNumber} 
                    scale={scale}
                    className="shadow-xl max-w-full"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-primary" />
                      </div>
                    }
                  />
                </Document>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="relative bg-background/90 hover:bg-background shadow-lg hover:shadow-xl backdrop-blur-sm z-10 h-8 w-8 md:h-32 md:w-32 rounded-full flex-shrink-0 transition-all duration-200 border-2 border-border hover:border-primary"
                onClick={() => changePage(1)}
                disabled={pageNumber >= numPages}
              >
                <RiArrowRightSLine className="h-4 w-4 md:h-16 md:w-16 text-foreground/80 hover:text-primary" />
              </Button>
            </div>
          )}
        </div>
        
        {numPages > 0 && (
          <div className="progress-bar sticky bottom-[49px] w-full h-2 bg-muted/50 shadow-inner">
            <div 
              className="h-full bg-primary/90 transition-all duration-300 shadow-lg"
              style={{ 
                width: `${(pageNumber / numPages) * 100}%`,
                borderRadius: '0 4px 4px 0'
              }}
            />
          </div>
        )}
        
        <footer className="sticky bottom-0 left-0 right-0 p-1 md:p-2 bg-background/80 backdrop-blur-sm border-t flex items-center justify-between text-xs md:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="hidden md:inline">Powered by</span>
            <span>Malak</span>
            {numPages > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                {((pageNumber / numPages) * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="flex gap-2 md:gap-4">
            <a href="/terms" className="hover:text-foreground">Terms</a>
            <a href="/privacy" className="hover:text-foreground">Privacy</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
