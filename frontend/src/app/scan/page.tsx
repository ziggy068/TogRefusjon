"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { parseTicket, createTicketDraft } from "@/lib/ticketParser";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AuthGate from "@/components/AuthGate";

function ScanPageContent() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [lastScannedData, setLastScannedData] = useState<string>("");

  // Get available camera devices
  useEffect(() => {
    async function getDevices() {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDeviceId) {
          // Prefer back camera on mobile
          const backCamera = videoDevices.find((d) =>
            d.label.toLowerCase().includes("back")
          );
          setSelectedDeviceId(backCamera?.deviceId || videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    }
    getDevices();
  }, [selectedDeviceId]);

  // Start camera stream
  const startCamera = async () => {
    try {
      setError(null);
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: "environment" }, // Prefer back camera
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
        scanFrame();
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setHasPermission(false);
      if (err.name === "NotAllowedError") {
        setError("Kameratilgang nektet. Vennligst gi tillatelse i nettleserinnstillingene.");
      } else if (err.name === "NotFoundError") {
        setError("Ingen kamera funnet på enheten.");
      } else {
        setError("Kunne ikke starte kamera. Prøv filopplasting i stedet.");
      }
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsScanning(false);
  };

  // Scan video frame for QR code
  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data for QR detection
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Detect QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      // Prevent duplicate scans
      if (code.data !== lastScannedData) {
        setLastScannedData(code.data);
        handleQRDetected(code.data);
      }
    }

    // Continue scanning
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  // Handle detected QR code
  const handleQRDetected = (data: string) => {
    console.log("QR detected:", data);

    const parsed = parseTicket(data);

    if (parsed) {
      // Successfully parsed
      const draft = createTicketDraft(parsed);
      localStorage.setItem("ticketDraft", JSON.stringify(draft));

      showToast("QR-kode funnet! Skjema er forhåndsutfylt.", "success");

      // Stop camera and redirect
      stopCamera();
      setTimeout(() => {
        router.push("/billetter/upload");
      }, 1000);
    } else {
      // Could not parse - show raw data
      showToast("Ukjent QR-format. Viser rådata.", "info");
      localStorage.setItem(
        "ticketDraft",
        JSON.stringify({
          beskrivelse: `QR-data: ${data}`,
        })
      );

      stopCamera();
      setTimeout(() => {
        router.push("/billetter/upload");
      }, 1000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      {ToastComponent}

      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Skann QR-kode</h1>
          <p className="text-slate-600 mt-2">
            Hold kameraet over QR-koden på billetten din
          </p>
        </div>

        {/* Camera selection */}
        {devices.length > 1 && !isScanning && (
          <Card className="p-4 mb-4">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Velg kamera
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Kamera ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </Card>
        )}

        {/* Video preview */}
        <Card className="p-0 overflow-hidden mb-4">
          <div className="relative bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-4 border-primary-500 rounded-lg w-64 h-64 animate-pulse" />
              </div>
            )}

            {/* Instructions */}
            {!isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-center text-white p-6">
                  <div className="text-5xl mb-4">📷</div>
                  <p className="text-lg font-medium">
                    Trykk Start for å skanne
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Error message */}
        {error && (
          <Card className="p-4 mb-4 bg-rose-50 border-rose-200">
            <div className="flex gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="font-medium text-rose-900">Feil med kamera</p>
                <p className="text-sm text-rose-700 mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {!isScanning ? (
            <Button onClick={startCamera} className="flex-1">
              Start skanning
            </Button>
          ) : (
            <Button onClick={stopCamera} variant="secondary" className="flex-1">
              Stopp skanning
            </Button>
          )}

          <Button
            onClick={() => router.push("/billetter/upload")}
            variant="secondary"
          >
            Manuell opplasting
          </Button>
        </div>

        {/* Help card */}
        <Card className="p-4 mt-4 bg-slate-50">
          <div className="flex gap-3">
            <span className="text-xl">💡</span>
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">Tips for skanning</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Hold kameraet stabilt over QR-koden</li>
                <li>Sørg for god belysning</li>
                <li>QR-koden skal fylle den blå rammen</li>
                <li>Hvis skanning ikke fungerer, bruk manuell opplasting</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ScanPage() {
  return (
    <AuthGate>
      <ScanPageContent />
    </AuthGate>
  );
}
