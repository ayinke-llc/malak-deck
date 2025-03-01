'use client';

import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDownloadLine, RiFullscreenLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiQuestionLine,
  RiAlertLine
} from '@remixicon/react';
import { useEffect, useState, use } from "react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { Tour } from 'shepherd.js';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';
import { useQuery } from '@tanstack/react-query';

// Configure PDF.js worker correctly
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Define options outside component for better performance
const options = {
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts`
};

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

interface MalakPasswordDeckPreferences {
  enabled: boolean;
  password: string;
}

interface MalakDeckPreference {
  created_at: string;
  created_by: string;
  deck_id: string;
  enable_downloading: boolean;
  expires_at: string;
  id: string;
  password: MalakPasswordDeckPreferences;
  reference: string;
  require_email: boolean;
  updated_at: string;
  workspace_id: string;
}

interface MalakPublicDeck {
  created_at: string;
  deck_size: number;
  is_archived: boolean;
  object_link: string;
  preferences: MalakDeckPreference;
  reference: string;
  short_link: string;
  title: string;
  updated_at: string;
  workspace_id: string;
}

interface APIResponse {
  deck: MalakPublicDeck;
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 blur-3xl rounded-full" />

          <div className="relative bg-card border shadow-xl rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-destructive/20 animate-ping rounded-full" />
                <div className="relative rounded-full bg-destructive/10 p-4">
                  <RiAlertLine className="w-8 h-8 text-destructive animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">Unable to load PDF</h2>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-[90%] mx-auto">
                  {message}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  onClick={() => window.location.reload()}
                  className="w-full sm:w-auto gap-2 group"
                >
                  <span className="relative">
                    <span className="animate-spin-slow absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      ↻
                    </span>
                    <span className="group-hover:opacity-0 transition-opacity">
                      Try again
                    </span>
                  </span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="w-full sm:w-auto"
                >
                  Go back
                </Button>
              </div>

              <p className="text-xs text-muted-foreground pt-4 border-t w-full">
                If the problem persists, please try again later or contact support
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PDFViewer({ params }: PageProps) {
  const { slug } = use(params);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [showPreview, setShowPreview] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const { data: pdfData, isError: isPdfError, error: queryError, isLoading: isApiLoading } = useQuery<APIResponse>({
    queryKey: ['pdf', slug],
    queryFn: async () => {
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/v1/public/decks/${slug}`;
        const response = await fetch(apiUrl);
        
        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error('Invalid JSON response from API');
        }
        
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid API response format');
        }

        if (!data.deck) {
          throw new Error('Deck not found in API response');
        }

        if (!data.deck.object_link) {
          throw new Error('PDF URL not found in deck data');
        }

        return data;
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch deck data');
      }
    },
    retry: 1,
    retryDelay: 1000,
  });

  const pdfUrl = pdfData?.deck?.object_link;

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [scale, setScale] = useState<number>(1.0);

  const [tour, setTour] = useState<Tour | null>(null);

  useEffect(() => {
    if (!pdfUrl) {
      return;
    }

    const downloadPDF = async () => {
      setIsPdfLoading(true);
      try {
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error('Failed to download PDF');

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let receivedLength = 0;

        while (true && reader) {
          const { done, value } = await reader.read();

          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          if (total) {
            setDownloadProgress((receivedLength / total) * 100);
          }
        }

        const chunksAll = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
          chunksAll.set(chunk, position);
          position += chunk.length;
        }

        const blob = new Blob([chunksAll], { type: 'application/pdf' });
        setPdfBlob(blob);
        setError(null);
      } catch (err) {
        setError('Error downloading PDF. Please try again later.');
      } finally {
        setIsPdfLoading(false);
      }
    };

    downloadPDF();
  }, [pdfUrl]);

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
        beforeShowPromise: function () {
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
    if (tour && !localStorage.getItem('tourCompleted') && !isPdfLoading && pdfBlob) {
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
          requestAnimationFrame(() => {
            tour.start();
          });
        } else {
          setTimeout(startTour, 200);
        }
      };

      setTimeout(startTour, 1000);

      tour.on('complete', () => {
        localStorage.setItem('tourCompleted', 'true');
      });

      tour.on('cancel', () => {
        localStorage.setItem('tourCompleted', 'true');
      });

      return () => {
        tour.complete();
      };
    }
  }, [tour, isPdfLoading, pdfBlob]);

  // Function to manually start the tour
  const startTourManually = () => {
    localStorage.removeItem('tourCompleted');
    localStorage.removeItem('shepherd-tour');
    if (tour) {
      requestAnimationFrame(() => {
        tour.start();
      });
    }
  };

  // Add this useEffect after the other useEffects
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if the pressed key is "?" and no input element is focused
      if (e.key === '?' && document.activeElement?.tagName !== 'INPUT') {
        startTourManually();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [tour]); // Add tour as a dependency since we use startTourManually

  // If we're loading the API data or the PDF, or if we don't have a URL yet, show loading
  if (isApiLoading || isPdfLoading || !pdfUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 w-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
          <div className="w-full bg-muted rounded-full h-2.5 dark:bg-muted">
            {isPdfLoading && (
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              ></div>
            )}
          </div>
          <p className="text-muted-foreground">
            {isApiLoading 
              ? 'Loading deck details...' 
              : !pdfUrl
                ? 'Preparing deck...'
                : isPdfLoading 
                  ? `Downloading PDF... ${downloadProgress.toFixed(0)}%`
                  : 'Preparing PDF...'}
          </p>
        </div>
      </div>
    );
  }

  // Only show error UI for actual PDF loading errors
  if (error) {
    return (
      <ErrorDisplay message={error} />
    );
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
            <h1 className="font-medium text-sm truncate hidden md:block">{slug}</h1>
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
