"use client";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  RiAlertLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiDownloadLine,
  RiFullscreenLine,
  RiLockLine,
  RiMailLine,
  RiMenuFoldLine,
  RiMenuUnfoldLine,
  RiQuestionLine,
} from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { use, useEffect, useState, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { Tour } from "shepherd.js";
import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";

// Configure PDF.js worker correctly
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const options = {
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts`,
};

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

interface MalakDeckPreference {
  enable_downloading?: boolean;
  has_password?: boolean;
  require_email?: boolean;
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
  session: DeckViewerSession;
}

interface DeckViewerSession {
  id: string;
  reference: string;
  deck_id: string;
  contact_id?: string;
  session_id: string;
  device_info: string;
  os: string;
  browser: string;
  ip_address: string;
  country: string;
  city: string;
  viewed_at: string;
  created_at: string;
  updated_at: string;
}

interface APIResponse {
  deck: MalakPublicDeck;
}

interface CreateDeckViewerSessionPayload {
  os: string;
  device_info: string;
  browser: string;
  email?: string;
  password?: string;
}

interface CreateDeckViewerSessionResponse {
  deck: MalakPublicDeck;
  session: DeckViewerSession;
}

interface UpdateDeckViewerSessionPayload {
  email?: string;
  password?: string;
  time_spent?: number;
  session_id: string;
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
                <h2 className="text-xl font-semibold tracking-tight">
                  Unable to load PDF
                </h2>
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
                If the problem persists, please try again later or contact
                support
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

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Time tracking state
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
      if (document.visibilityState === 'visible') {
        lastUpdateTimeRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // track time and send updates
  useEffect(() => {
    if (!isAuthenticated || !sessionId) return;

    const updateTimeSpent = async () => {
      if (!isVisible || !sessionId) return;

      const now = Date.now();
      const timeDiff = Math.floor((now - lastUpdateTimeRef.current) / 1000);
      lastUpdateTimeRef.current = now;

      setTimeSpentSeconds(prev => prev + timeDiff);

      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/v1/public/decks/${slug}`;
        const payload: UpdateDeckViewerSessionPayload = {
          session_id: sessionId,
          time_spent: timeSpentSeconds + timeDiff
        };

        await axios.put(apiUrl, payload);
      } catch (error) {
        Sentry.captureException(error, {
          extra: {
            sessionId,
            timeSpentSeconds,
            slug,
          },
        });
        console.error('Failed to update time spent:', error);
      }
    };

    const intervalId = setInterval(updateTimeSpent, 30000); // Update every 30 seconds

    return () => {
      clearInterval(intervalId);
      // Send a final update when component unmounts if we have a valid session
      if (sessionId) {
        updateTimeSpent();
      }
    };
  }, [isAuthenticated, sessionId, slug, isVisible, timeSpentSeconds]);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const browserInfo = {
      arc: /arc/i.test(ua),
      chrome: /chrome|crios/i.test(ua) && !/edg|edge|arc/i.test(ua),
      safari: /safari/i.test(ua) && !/chrome|crios|edg|edge|arc/i.test(ua),
      firefox: /firefox|fxios/i.test(ua),
      edge: /edg|edge/i.test(ua),
      opera: /opr|opera/i.test(ua),
      brave: Boolean((navigator as any).brave),
    } as const;

    const browser =
      Object.keys(browserInfo).find(
        (key) => browserInfo[key as keyof typeof browserInfo]
      ) || "Unknown Browser";

    const osInfo = {
      Windows: /Windows/.test(ua),
      macOS: /Macintosh/.test(ua),
      iOS: /iPhone|iPad|iPod/.test(ua),
      Android: /Android/.test(ua),
      Linux: /Linux/.test(ua) && !/Android/.test(ua),
    } as const;

    const os =
      Object.keys(osInfo).find((key) => osInfo[key as keyof typeof osInfo]) ||
      "Unknown OS";

    interface NavigatorWithMemory extends Navigator {
      deviceMemory?: number;
      connection?: {
        effectiveType?: string;
      };
    }

    const nav = navigator as NavigatorWithMemory;

    const deviceInfo = {
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      deviceType: /Mobile|Android|iPhone|iPad|iPod/i.test(ua)
        ? "Mobile"
        : "Desktop",
      deviceMemory: nav.deviceMemory
        ? `${nav.deviceMemory}GB RAM`
        : "Unknown Memory",
      cores: navigator.hardwareConcurrency
        ? `${navigator.hardwareConcurrency} CPU Cores`
        : "Unknown Cores",
      touchCapable: navigator.maxTouchPoints > 0 ? "Touch Enabled" : "No Touch",
      connectionType: nav.connection?.effectiveType || "Unknown Connection",
    };

    return {
      os,
      browser: browser.charAt(0).toUpperCase() + browser.slice(1),
      deviceInfoString: deviceInfo.deviceType,
    };
  };

  const {
    data: pdfData,
    isError: isPdfError,
    error: queryError,
    isLoading: isApiLoading,
  } = useQuery<APIResponse>({
    queryKey: ["pdf", slug],
    queryFn: async () => {
      try {
        const deviceInfo = getDeviceInfo();

        const payload: CreateDeckViewerSessionPayload = {
          os: deviceInfo.os,
          device_info: deviceInfo.deviceInfoString,
          browser: deviceInfo.browser,
          email: email || undefined,
          password: password || undefined,
        };

        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/v1/public/decks/${slug}`;
        const response = await axios.post<CreateDeckViewerSessionResponse>(
          apiUrl,
          payload
        );

        if (!response.data || typeof response.data !== "object") {
          const error = new Error("Invalid API response format");
          Sentry.captureException(error, {
            extra: {
              responseData: response.data,
              slug,
              deviceInfo,
            },
          });
          throw error;
        }

        if (!response.data.deck) {
          const error = new Error("Deck not found in API response");
          Sentry.captureException(error, {
            extra: {
              responseData: response.data,
              slug,
            },
          });
          throw error;
        }

        if (!response.data.deck.object_link) {
          const error = new Error("PDF URL not found in deck data");
          Sentry.captureException(error, {
            extra: {
              deck: response.data.deck,
              slug,
            },
          });
          throw error;
        }

        return {
          deck: response.data.deck,
          session: response.data.session,
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          Sentry.captureException(error, {
            extra: {
              url: `${process.env.NEXT_PUBLIC_API_URL}/v1/public/decks/${slug}`,
              slug,
              status: error.response?.status,
              statusText: error.response?.statusText,
              responseData: error.response?.data,
            },
          });
          throw new Error(
            error.response?.data?.message || "Failed to fetch deck data"
          );
        }
        Sentry.captureException(error);
        throw error;
      }
    },
    retry: 1,
    retryDelay: 1000,
  });

  // Update sessionId effect
  useEffect(() => {
    if (pdfData?.deck?.session?.session_id) {
      setSessionId(pdfData.deck.session.session_id);
    }
  }, [pdfData]);

  const pdfUrl = pdfData?.deck?.object_link;

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [scale, setScale] = useState<number>(1.0);

  const [tour, setTour] = useState<Tour | null>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!pdfUrl) {
      return;
    }

    const downloadPDF = async () => {
      setIsPdfLoading(true);
      try {
        const response = await axios.get(pdfUrl, {
          responseType: "arraybuffer",
          onDownloadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) /
              (progressEvent.total || progressEvent.loaded)
            );
            setDownloadProgress(percentCompleted);
          },
        });

        const blob = new Blob([response.data], { type: "application/pdf" });
        setPdfBlob(blob);
        setError(null);
      } catch (err) {
        setError("Error downloading PDF. Please try again later.");
      } finally {
        setIsPdfLoading(false);
      }
    };

    downloadPDF();
  }, [pdfUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        changePage(1);
      } else if (e.key === "ArrowLeft") {
        changePage(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages, pageNumber]);

  useEffect(() => {
    function updateScale() {
      const container = document.querySelector(".pdf-container");
      if (container && pdfBlob) {
        const containerWidth = container.clientWidth - (isMobile ? 32 : 160);
        const baseScale = containerWidth / 600;

        // Larger scale for desktop, smaller for mobile
        setScale(
          isMobile ? Math.min(baseScale, 0.8) : Math.min(baseScale, 2.0)
        );
      }
    }

    window.addEventListener("resize", updateScale);
    updateScale();
    return () => window.removeEventListener("resize", updateScale);
  }, [isMobile, pdfBlob]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    Sentry.captureException(error, {
      extra: {
        pdfUrl,
        slug,
      },
    });
    setError("Error loading PDF. Please try again later.");
  }

  function changePage(offset: number) {
    setPageNumber((prevPageNumber) =>
      Math.min(Math.max(1, prevPageNumber + offset), numPages)
    );
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
        classes: "shadow-lg rounded-lg border bg-background text-foreground",
        modalOverlayOpeningPadding: 4,
        scrollTo: true,
        cancelIcon: {
          enabled: true,
        },
        arrow: true,
        when: {
          show() {
            const content = document.querySelector(".shepherd-content");
            const text = document.querySelector(".shepherd-text");
            const footer = document.querySelector(".shepherd-footer");
            const buttons = document.querySelectorAll(".shepherd-button");

            if (content) content.classList.add("p-6");
            if (text) text.classList.add("mb-4", "leading-normal");
            if (footer) footer.classList.add("flex", "justify-end", "gap-2");

            buttons.forEach((button) => {
              button.classList.add(
                "inline-flex",
                "items-center",
                "justify-center",
                "rounded-md",
                "text-sm",
                "font-medium",
                "transition-colors",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-ring",
                "disabled:pointer-events-none",
                "disabled:opacity-50",
                "h-9",
                "px-4",
                "py-2"
              );
            });

            // Style primary button
            const nextButton = buttons[buttons.length - 1];
            if (nextButton) {
              nextButton.classList.add(
                "bg-primary",
                "text-primary-foreground",
                "hover:bg-primary/90"
              );
            }

            // Style back button
            const backButton = buttons[0];
            if (backButton && buttons.length > 1) {
              backButton.classList.add(
                "border",
                "border-input",
                "bg-background",
                "hover:bg-accent",
                "hover:text-accent-foreground"
              );
            }
          },
        },
      },
    });

    newTour.addSteps([
      {
        id: "sidebar",
        text: "Toggle the sidebar to view all pages in the document",
        attachTo: {
          element: ".sidebar-toggle",
          on: "right",
        },
        buttons: [
          {
            text: "Next",
            action: () => newTour.next(),
          },
        ],
        beforeShowPromise: function () {
          return new Promise<void>((resolve) => {
            if (document.querySelector(".sidebar-toggle")) {
              resolve();
            } else {
              const observer = new MutationObserver((mutations, obs) => {
                if (document.querySelector(".sidebar-toggle")) {
                  obs.disconnect();
                  resolve();
                }
              });

              observer.observe(document.body, {
                childList: true,
                subtree: true,
              });

              // timeout after 5 seconds to prevent infinite waiting
              setTimeout(() => {
                observer.disconnect();
                resolve();
              }, 5000);
            }
          });
        },
      },
      {
        id: "navigation",
        text: "Navigate through pages using these controls or your keyboard arrow keys",
        attachTo: {
          element: ".page-navigation",
          on: "bottom",
        },
        buttons: [
          {
            text: "Back",
            action: () => newTour.back(),
          },
          {
            text: "Next",
            action: () => newTour.next(),
          },
        ],
      },
      {
        id: "download",
        text: "Download the document for offline viewing",
        attachTo: {
          element: ".download-button",
          on: "bottom",
        },
        buttons: [
          {
            text: "Back",
            action: () => newTour.back(),
          },
          {
            text: "Next",
            action: () => newTour.next(),
          },
        ],
      },
      {
        id: "fullscreen",
        text: "Toggle fullscreen mode for a more immersive reading experience",
        attachTo: {
          element: ".fullscreen-button",
          on: "bottom",
        },
        buttons: [
          {
            text: "Back",
            action: () => newTour.back(),
          },
          {
            text: "Next",
            action: () => newTour.next(),
          },
        ],
      },
      {
        id: "theme",
        text: "Switch between light and dark mode for comfortable reading",
        attachTo: {
          element: ".theme-switcher button",
          on: "bottom",
        },
        buttons: [
          {
            text: "Back",
            action: () => newTour.back(),
          },
          {
            text: "Next",
            action: () => newTour.next(),
          },
        ],
      },
      {
        id: "progress",
        text: "Track your reading progress here",
        attachTo: {
          element: ".progress-bar",
          on: "top",
        },
        buttons: [
          {
            text: "Back",
            action: () => newTour.back(),
          },
          {
            text: "Done",
            action: () => newTour.complete(),
          },
        ],
      },
    ]);

    setTour(newTour);
  }, []);

  useEffect(() => {
    if (
      tour &&
      !localStorage.getItem("tourCompleted") &&
      !isPdfLoading &&
      pdfBlob
    ) {
      // Clear any existing tour state
      localStorage.removeItem("shepherd-tour");

      // Only start tour when PDF is loaded and elements are ready
      const startTour = () => {
        const elements = [
          ".sidebar-toggle",
          ".page-navigation",
          ".download-button",
          ".theme-switcher",
          ".progress-bar",
        ];

        // Check if all required elements are present
        const missingElements = elements.filter(
          (selector) => !document.querySelector(selector)
        );

        if (missingElements.length === 0) {
          requestAnimationFrame(() => {
            tour.start();
          });
        } else {
          setTimeout(startTour, 200);
        }
      };

      setTimeout(startTour, 1000);

      tour.on("complete", () => {
        localStorage.setItem("tourCompleted", "true");
      });

      tour.on("cancel", () => {
        localStorage.setItem("tourCompleted", "true");
      });

      return () => {
        tour.complete();
      };
    }
  }, [tour, isPdfLoading, pdfBlob]);

  // manually start the tour
  const startTourManually = () => {
    localStorage.removeItem("tourCompleted");
    localStorage.removeItem("shepherd-tour");
    if (tour) {
      requestAnimationFrame(() => {
        tour.start();
      });
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if the pressed key is "?" and no input element is focused
      if (e.key === "?" && document.activeElement?.tagName !== "INPUT") {
        startTourManually();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [tour]); // Add tour as a dependency since we use startTourManually

  useEffect(() => {
    if (pdfData?.deck) {
      const { has_password, require_email } = pdfData.deck.preferences;

      if (has_password && !isPasswordVerified) {
        setShowPasswordDialog(true);
        return;
      }

      if (require_email && !isEmailVerified) {
        setShowEmailDialog(true);
        return;
      }

      if (
        (!has_password || isPasswordVerified) &&
        (!require_email || isEmailVerified)
      ) {
        setIsAuthenticated(true);
      }
    }
  }, [pdfData, isPasswordVerified, isEmailVerified]);

  const handlePasswordSubmit = async () => {
    try {
      setIsPasswordSubmitting(true);

      if (!password.trim()) {
        throw new Error("Password is required");
      }

      setIsPasswordVerified(true);
      setShowPasswordDialog(false);
      setAuthError(null);

      if (pdfData?.deck?.preferences?.require_email && !isEmailVerified) {
        setShowEmailDialog(true);
      } else {
        if (!pdfData?.deck?.session?.session_id) {
          throw new Error("No session ID available");
        }

        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/v1/public/decks/${slug}`;
        const payload: UpdateDeckViewerSessionPayload = {
          password: password,
          session_id: pdfData.deck.session.session_id,
        };

        await axios.put(apiUrl, payload);

        queryClient.invalidateQueries({
          queryKey: ["pdf", slug],
        });
      }
    } catch (err) {
      setAuthError("Invalid password. Please try again.");
      setIsPasswordVerified(false);
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleEmailSubmit = async () => {
    try {
      setIsEmailSubmitting(true);

      const emailSchema = z.string().email();
      emailSchema.parse(email);

      if (!pdfData?.deck?.session?.session_id) {
        throw new Error("No session ID available");
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/v1/public/decks/${slug}`;
      const payload: UpdateDeckViewerSessionPayload = {
        email: email,
        password: password,
        session_id: pdfData.deck.session.session_id,
      };

      await axios.put(apiUrl, payload);

      setIsEmailVerified(true);
      setShowEmailDialog(false);
      setAuthError(null);

      queryClient.invalidateQueries({
        queryKey: ["pdf", slug],
      });
    } catch (err) {
      console.log(err);
      setAuthError("Please enter a valid email address.");
      setIsEmailVerified(false);
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const AuthPromptOverlay = () => {
    const { has_password, require_email } = pdfData?.deck?.preferences || {};
    const needsAuth =
      (has_password && !isPasswordVerified) ||
      (require_email && !isEmailVerified);

    if (!needsAuth) return null;

    return (
      <div className="absolute inset-0 flex items-center justify-center z-50 bg-background/50 backdrop-blur-sm">
        <div className="bg-card border shadow-lg rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
          <div className="space-y-2 text-center">
            <h3 className="text-lg font-semibold">Authentication Required</h3>
            <p className="text-sm text-muted-foreground">
              {has_password &&
                !isPasswordVerified &&
                require_email &&
                !isEmailVerified
                ? "This deck requires both a password and email to view."
                : has_password && !isPasswordVerified
                  ? "This deck requires a password to view."
                  : "This deck requires an email to view."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {has_password && !isPasswordVerified && (
              <Button
                className="w-full"
                onClick={() => setShowPasswordDialog(true)}
                variant="outline"
              >
                <RiLockLine className="mr-2 h-4 w-4" />
                Enter Password
              </Button>
            )}
            {require_email && !isEmailVerified && (
              <Button
                className="w-full"
                onClick={() => setShowEmailDialog(true)}
                variant="outline"
              >
                <RiMailLine className="mr-2 h-4 w-4" />
                Provide Email
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handlePasswordDialogChange = (open: boolean) => {
    setShowPasswordDialog(open);
    if (!open && !isPasswordVerified) {
      setPassword("");
    }
  };

  const handleEmailDialogChange = (open: boolean) => {
    setShowEmailDialog(open);
    if (!open && !isEmailVerified) {
      setEmail("");
    }
  };

  if (isPdfError) {
    const errorMessage =
      queryError instanceof Error
        ? queryError.message
        : "Failed to load deck details. Please try again later.";
    return <ErrorDisplay message={errorMessage} />;
  }

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
              ? "Loading deck details..."
              : !pdfUrl
                ? "Preparing deck..."
                : isPdfLoading
                  ? `Downloading PDF... ${downloadProgress.toFixed(0)}%`
                  : "Preparing PDF..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Dialog
        open={showPasswordDialog}
        onOpenChange={handlePasswordDialogChange}
      >
        <DialogContent className="sm:max-w-[425px] backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle>Password Required</DialogTitle>
            <DialogDescription>
              {pdfData?.deck?.preferences?.require_email
                ? "Please enter the password to continue. You'll be asked for your email next."
                : "Please enter the password to view this deck."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                className="col-span-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isPasswordSubmitting) {
                    handlePasswordSubmit();
                  }
                }}
                disabled={isPasswordSubmitting}
              />
            </div>
            {authError && (
              <p className="text-sm text-destructive">{authError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handlePasswordSubmit}
              disabled={isPasswordSubmitting}
            >
              {isPasswordSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-r-transparent" />
                  Verifying...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmailDialog} onOpenChange={handleEmailDialogChange}>
        <DialogContent className="sm:max-w-[425px] backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle>Email Required</DialogTitle>
            <DialogDescription>
              {pdfData?.deck?.preferences?.has_password
                ? "Great! Now please enter your email to view the deck."
                : "Please enter your email to view this deck."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                className="col-span-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isEmailSubmitting) {
                    handleEmailSubmit();
                  }
                }}
                disabled={isEmailSubmitting}
              />
            </div>
            {authError && (
              <p className="text-sm text-destructive">{authError}</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleEmailSubmit} disabled={isEmailSubmitting}>
              {isEmailSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-r-transparent" />
                  Verifying...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <aside
        className={`${showPreview ? "w-[240px] md:w-[240px]" : "w-0"
          } border-r flex flex-col transition-all duration-300 overflow-hidden fixed md:relative z-20 bg-background h-full`}
      >
        {showPreview && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPreview(false)}
            className="absolute right-2 top-2 z-30 md:hidden bg-background/80 backdrop-blur-sm hover:bg-background"
          >
            <RiMenuFoldLine className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1 overflow-y-auto">
          {numPages > 0 &&
            [...Array(numPages)].map((_, index) => (
              <div
                key={index}
                className={`p-4 hover:bg-accent cursor-pointer border-b
                ${pageNumber === index + 1 ? "bg-accent" : ""}`}
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
                <span className="text-sm text-muted-foreground">
                  Page {index + 1}
                </span>
              </div>
            ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col w-full overflow-hidden relative">
        {/* Add the AuthPromptOverlay here */}
        {!isAuthenticated && <AuthPromptOverlay />}

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
            <Separator
              orientation="vertical"
              className="mx-2 h-6 hidden md:block"
            />
            <h1 className="font-medium text-sm truncate hidden md:block">
              {slug}
            </h1>
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
              <span className="text-muted-foreground whitespace-nowrap">
                of {numPages}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {pdfData?.deck?.preferences?.enable_downloading ? (
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
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled
                title="Downloads are disabled for this deck"
              >
                <RiDownloadLine className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
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

        <div
          className={`flex-1 w-full flex items-center justify-center p-2 md:p-8 pb-16 pdf-container overflow-hidden ${!isAuthenticated &&
            (pdfData?.deck?.preferences?.has_password ||
              pdfData?.deck?.preferences?.require_email)
            ? "filter blur-lg"
            : ""
            }`}
        >
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
                borderRadius: "0 4px 4px 0",
              }}
            />
          </div>
        )}

        <footer className="sticky bottom-0 left-0 right-0 p-1 md:p-2 bg-background/80 backdrop-blur-sm border-t flex items-center justify-between text-xs md:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="hidden md:inline">Powered by</span>
            <a
              href="https://malak.vc"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Malak
            </a>
            {numPages > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                {((pageNumber / numPages) * 100).toFixed(0)}%
              </span>
            )}
          </div>
          <div className="flex gap-2 md:gap-4">
            <a href="/terms" className="hover:text-foreground">
              Terms
            </a>
            <a href="/privacy" className="hover:text-foreground">
              Privacy
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
}
