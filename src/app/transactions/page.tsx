"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createWorker } from "tesseract.js";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  ImagePlus,
  ScanLine,
  Trash2,
  Wallet,
  ShieldCheck,
  Loader2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
type Transaction = {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  type: "income" | "expense";
};
type PaymentStatus = "success" | "failed" | "pending" | "unknown";
const expenseCategories = [
  "Food & Dining",
  "Transportation",
  "Shopping",
  "Housing",
  "Bills & Utilities",
  "Entertainment",
  "Healthcare",
  "Education",
  "Travel",
  "Other",
];

const money = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}
function detectCategory(description: string) {
  const value = description.toLowerCase();
  if (/swiggy|zomato|restaurant|cafe|food|pizza|hotel|dining/.test(value))
    return "Food & Dining";
  if (/uber|ola|rapido|metro|bus|train|petrol|fuel|cab/.test(value))
    return "Transportation";
  if (/amazon|flipkart|myntra|shopping|store|mall/.test(value))
    return "Shopping";
  if (/electricity|water bill|recharge|mobile|internet|gas bill/.test(value))
    return "Bills & Utilities";
  if (/hospital|pharmacy|medical|clinic|medicine/.test(value))
    return "Healthcare";
  if (/movie|cinema|netflix|spotify|entertainment/.test(value))
    return "Entertainment";
  if (/college|school|course|education/.test(value)) return "Education";
  if (/flight|airline|travel|booking|hotel stay/.test(value)) return "Travel";
  return "Other";
}
function extractPaymentDetails(text: string) {
  const lower = text.toLowerCase();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[|]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Status is only inferred from words found in the screenshot.
  const failed =
    /\b(failed|declined|cancelled|canceled|reversed|unsuccessful)\b/i.test(
      text,
    );
  const pending = /\b(pending|processing|awaiting confirmation)\b/i.test(text);
  const successful =
    /\b(successful|success|completed|paid successfully|payment done)\b/i.test(
      text,
    );

  let status: PaymentStatus = "unknown";
  if (failed) status = "failed";
  else if (pending) status = "pending";
  else if (successful) status = "success";

  // First prefer a currency-marked amount (₹, Rs, or INR).
  const currencyRegex = /(?:₹|rs\.?|inr)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  const currencyAmounts = [...text.matchAll(currencyRegex)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);

  let amount = currencyAmounts[0] ?? 0;

  // OCR sometimes drops the rupee symbol. In that case, prefer a number
  // appearing on a line labelled amount / paid / sent / debited.
  if (!amount) {
    for (const line of lines) {
      if (!/\b(amount|paid|sent|debited|debit|total)\b/i.test(line)) continue;
      const match = line.match(
        /(?:^|[^\d])([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?!\d)/,
      );
      if (match?.[1]) {
        const value = Number(match[1].replace(/,/g, ""));
        if (Number.isFinite(value) && value > 0 && value < 100000000) {
          amount = value;
          break;
        }
      }
    }
  }

  // Last fallback: a standalone amount-like number, excluding long IDs,
  // dates, phone numbers, and obvious account/reference lines.
  if (!amount) {
    const ignoredAmountLine =
      /\b(upi|utr|rrn|reference|transaction id|txn id|account|a\/c|phone|mobile|date|time|balance)\b/i;
    for (const line of lines) {
      if (ignoredAmountLine.test(line)) continue;
      const match = line.match(
        /^\s*(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]{1,7}(?:\.[0-9]{1,2})?)\s*$/i,
      );
      if (match?.[1]) {
        const value = Number(match[1].replace(/,/g, ""));
        if (Number.isFinite(value) && value > 0 && value < 10000000) {
          amount = value;
          break;
        }
      }
    }
  }

  // UPI reference / UTR extraction.
  const referencePatterns = [
    /(?:upi\s*(?:ref(?:erence)?|id)|utr|rrn|transaction\s*id|txn\s*id|reference\s*no\.?)\s*[:#\-]?\s*([A-Z0-9]{8,30})/i,
    /\b([0-9]{12,22})\b/,
  ];
  let reference = "";
  for (const pattern of referencePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      reference = match[1];
      break;
    }
  }

  // Merchant detection: first look for explicit recipient phrases.
  let merchant = "";
  const explicitMerchantPattern =
    /(?:paid\s+to|sent\s+to|transferred\s+to|payment\s+to|merchant|received\s+from)\s*[:\-]?\s*(.+)/i;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(explicitMerchantPattern);
    if (match?.[1]) {
      let candidate = match[1]
        .replace(/\b(?:upi|ref(?:erence)?|transaction id|txn id)\b.*$/i, "")
        .replace(/(?:₹|rs\.?|inr)\s*[0-9,]+.*$/i, "")
        .trim();
      if (candidate.length >= 2 && !/^\d+$/.test(candidate)) {
        merchant = candidate.slice(0, 100);
        break;
      }
    }

    // Some app screens show "To" on one line and the recipient below it.
    if (/^(to|paid to|sent to)\s*:?$/i.test(lines[index]) && lines[index + 1]) {
      const next = lines[index + 1];
      if (next.length >= 2 && next.length <= 80 && /[a-z]/i.test(next)) {
        merchant = next.slice(0, 100);
        break;
      }
    }
  }

  // Fallback: choose a plausible standalone name, ignoring app labels,
  // payment status, dates, references, phone numbers and UPI IDs.
  if (!merchant) {
    const ignoredMerchantLine =
      /\b(phonepe|google\s*pay|gpay|paytm|bhim|upi|payment|successful|success|completed|failed|pending|processing|transaction|debited|credited|balance|bank|account|reference|utr|date|time|paid|sent|received|available|help|share|done)\b/i;
    const candidate = lines.find((line) => {
      return (
        line.length >= 3 &&
        line.length <= 60 &&
        /[a-z]/i.test(line) &&
        !ignoredMerchantLine.test(line) &&
        !/^\d/.test(line) &&
        !/@/.test(line) &&
        !/\b\d{5,}\b/.test(line) &&
        !/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(line)
      );
    });
    if (candidate) merchant = candidate.slice(0, 100);
  }

  // Detect payment app when its name is present in OCR text.
  let paymentApp = "UPI";
  if (/phonepe/i.test(lower)) paymentApp = "PhonePe";
  else if (/google\s*pay|gpay/i.test(lower)) paymentApp = "Google Pay";
  else if (/paytm/i.test(lower)) paymentApp = "Paytm";
  else if (/bhim/i.test(lower)) paymentApp = "BHIM";

  // Date in DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY format.
  let date = getToday();
  const dateMatch = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    let year = dateMatch[3];
    if (year.length === 2) year = `20${year}`;
    const candidate = `${year}-${month}-${day}`;
    const parsed = new Date(`${candidate}T00:00:00`);
    if (
      !Number.isNaN(parsed.getTime()) &&
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() + 1 === Number(month) &&
      parsed.getDate() === Number(day)
    ) {
      date = candidate;
    }
  }

  return { amount, merchant, reference, paymentApp, date, status };
}
export default function TransactionsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const uploadRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrText, setOcrText] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [detectedAmount, setDetectedAmount] = useState("");
  const [detectedMerchant, setDetectedMerchant] = useState("");
  const [detectedReference, setDetectedReference] = useState("");
  const [detectedApp, setDetectedApp] = useState("UPI");
  const [detectedDate, setDetectedDate] = useState(getToday());
  const [detectedCategory, setDetectedCategory] = useState("Other");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unknown");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "income" | "expense">("all");
  // Load transactions from Supabase.
  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.push("/login");
        return;
      }
      const [
        { data: expenses, error: expenseError },
        { data: incomes, error: incomeError },
      ] = await Promise.all([
        supabase
          .from("expenses")
          .select("id, description, amount, category, expense_date")
          .order("created_at", { ascending: false }),
        supabase
          .from("incomes")
          .select("id, description, amount, category, income_date")
          .order("created_at", { ascending: false }),
      ]);
      if (expenseError) throw expenseError;
      if (incomeError) throw incomeError;
      const combined: Transaction[] = [
        ...(expenses ?? []).map((item) => ({
          id: item.id,
          name: item.description,
          amount: Number(item.amount),
          category: item.category,
          date: item.expense_date,
          type: "expense" as const,
        })),
        ...(incomes ?? []).map((item) => ({
          id: item.id,
          name: item.description,
          amount: Number(item.amount),
          category: item.category,
          date: item.income_date,
          type: "income" as const,
        })),
      ];
      combined.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setTransactions(combined);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to load transactions.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);
  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);
  // Image preview.
  useEffect(() => {
    if (!selectedFile) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  // Attach stream to camera preview.
  useEffect(() => {
    if (!isCameraOpen || !streamRef.current || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch((err) => {
      console.error(err);
      setCameraError("Unable to start camera preview.");
    });
    return () => {
      video.srcObject = null;
    };
  }, [isCameraOpen]);
  // Stop camera on page exit.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);
  const totalIncome = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const filteredTransactions = transactions.filter((item) => {
    const matchesTab = tab === "all" || item.type === tab;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });
  // Camera functions.
  async function startCamera() {
    try {
      setCameraError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera requires HTTPS or localhost.");
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
    } catch (err) {
      console.error(err);
      setCameraError(
        err instanceof Error
          ? err.message
          : "Please allow camera access in your browser.",
      );
    }
  }
  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraOpen(false);
  }
  function capturePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCameraError("Camera is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Unable to capture image.");
          return;
        }
        const file = new File([blob], `upi-payment-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setSelectedFile(file);
        setOcrText("");
        setScanStatus("");
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  }
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
    setOcrText("");
    setScanStatus("");
    setCameraError("");
  }
  function resetScanner() {
    stopCamera();
    setSelectedFile(null);
    setOcrText("");
    setScanStatus("");
    setScanProgress(0);
    setDetectedAmount("");
    setDetectedMerchant("");
    setDetectedReference("");
    setDetectedApp("UPI");
    setDetectedDate(getToday());
    setDetectedCategory("Other");
    setPaymentStatus("unknown");
    if (uploadRef.current) uploadRef.current.value = "";
  }
  // OCR scanner.
  async function scanImage() {
    if (!selectedFile) return;
    setScanning(true);
    setScanProgress(0);
    setScanStatus("Starting text recognition...");
    try {
      const worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setScanProgress(Math.round(message.progress * 100));
          }
        },
      });
      try {
        const result = await worker.recognize(selectedFile);
        const text = result.data.text.trim();
        if (!text) {
          setOcrText("");
          setDetectedAmount("");
          setDetectedMerchant("");
          setScanStatus(
            "No readable text was found. Try a sharper screenshot with the full payment details visible.",
          );
          return;
        }
        setOcrText(text);
        const details = extractPaymentDetails(text);
        setDetectedAmount(details.amount > 0 ? String(details.amount) : "");
        setDetectedMerchant(details.merchant);
        setDetectedReference(details.reference);
        setDetectedApp(details.paymentApp);
        setDetectedDate(details.date);
        setPaymentStatus(details.status);
        setDetectedCategory(detectCategory(details.merchant || text));
        if (!details.amount || !details.merchant) {
          setScanStatus(
            `Text scanned. ${!details.amount ? "Amount not confidently detected. " : ""}${!details.merchant ? "Merchant not confidently detected. " : ""}Please check the raw OCR text and enter any missing details manually.`,
          );
        } else if (details.status === "failed") {
          setScanStatus(
            "A failed or reversed payment status was detected. Do not save this as an expense.",
          );
        } else if (details.status === "pending") {
          setScanStatus(
            "This payment appears pending. Verify its final status before saving.",
          );
        } else if (details.status === "success") {
          setScanStatus(
            "A success message was detected. Please verify the details before saving.",
          );
        } else {
          setScanStatus(
            "Text extracted, but payment status could not be identified. Verify the payment independently.",
          );
        }
      } finally {
        await worker.terminate();
      }
    } catch (err) {
      console.error("OCR error:", err);
      setScanStatus("OCR failed. Please try a clearer screenshot.");
    } finally {
      setScanning(false);
    }
  }
  // Save confirmed expense.
  async function saveScannedExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(detectedAmount);
    if (!detectedMerchant.trim()) {
      alert("Please enter the merchant or transaction description.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if (paymentStatus === "failed" || paymentStatus === "pending") {
      alert(
        "Failed or pending payments cannot be saved as completed expenses.",
      );
      return;
    }
    if (
      !window.confirm(
        "Have you independently verified that this payment was completed? Save it as an expense?",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Please log in again.");
      // Basic duplicate check using existing database fields.
      const { data: possibleDuplicates, error: duplicateError } = await supabase
        .from("expenses")
        .select("id, description, amount, expense_date")
        .eq("amount", value)
        .eq("expense_date", detectedDate)
        .ilike("description", detectedMerchant.trim())
        .limit(1);
      if (duplicateError) throw duplicateError;
      if (possibleDuplicates && possibleDuplicates.length > 0) {
        alert(
          "A matching expense already exists for this description, amount and date. Please check your transaction history.",
        );
        return;
      }
      const { error: insertError } = await supabase.from("expenses").insert({
        description: detectedMerchant.trim(),
        amount: value,
        category: detectedCategory,
        expense_date: detectedDate,
      });
      if (insertError) throw insertError;
      alert(
        "Expense saved! Your dashboard will include it in its expense and budget calculations.",
      );
      resetScanner();
      await loadTransactions();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Unable to save transaction.");
    } finally {
      setSaving(false);
    }
  }
  async function deleteTransaction(item: Transaction) {
    if (!window.confirm(`Delete "${item.name}" permanently?`)) return;
    setSaving(true);
    try {
      const table = item.type === "expense" ? "expenses" : "incomes";
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("id", item.id);
      if (deleteError) throw deleteError;
      await loadTransactions();
    } catch (err) {
      console.error(err);
      alert("Unable to delete transaction.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#0c0d14] p-5 text-white md:p-8">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-xl border border-white/10 p-3 hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Transactions</h1>
            <p className="text-sm text-gray-400">
              Manage and scan your transactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400">
          <Wallet size={17} />
          RV SpendWise
        </div>
      </header>
      {error && (
        <div className="mb-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}
      {/* Summary */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Total Income"
          amount={totalIncome}
          icon={<ArrowDownLeft />}
          color="text-green-400"
        />
        <SummaryCard
          title="Total Expenses"
          amount={totalExpenses}
          icon={<ArrowUpRight />}
          color="text-red-400"
        />
        <SummaryCard
          title="Net Savings"
          amount={totalIncome - totalExpenses}
          icon={<Wallet />}
          color="text-violet-300"
        />
      </section>
      {/* Scanner */}
      <section className="mb-8 rounded-2xl border border-white/10 bg-[#151722] p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-violet-500/15 p-3">
            <ScanLine size={25} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">UPI Transaction Scanner</h2>
            <p className="text-sm text-gray-400">
              Capture or upload a payment screenshot
            </p>
          </div>
        </div>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {cameraError && (
          <p className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
            {cameraError}
          </p>
        )}
        {isCameraOpen ? (
          <div className="rounded-xl bg-[#10111b] p-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[500px] w-full rounded-xl bg-black"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={capturePhoto}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold"
              >
                <Camera size={18} />
                Capture Photo
              </button>
              <button
                onClick={stopCamera}
                className="rounded-xl border border-white/15 px-5 py-3"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !preview ? (
          <div className="rounded-2xl border-2 border-dashed border-white/15 bg-[#10111b] px-5 py-12 text-center">
            <ScanLine size={38} className="mx-auto mb-4 text-violet-400" />
            <h3 className="mb-2 text-lg font-semibold">
              Scan your UPI payment
            </h3>
            <p className="mx-auto mb-7 max-w-md text-sm text-gray-400">
              Upload a Google Pay, PhonePe, Paytm or other UPI payment
              screenshot.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                onClick={() => uploadRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-semibold"
              >
                <ImagePlus size={19} />
                Upload Screenshot
              </button>
              <button
                onClick={startCamera}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-3 font-semibold"
              >
                <Camera size={19} />
                Use Camera
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-[#10111b] p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Payment screenshot</h3>
              <button
                onClick={resetScanner}
                className="flex items-center gap-2 text-sm text-red-400"
              >
                <Trash2 size={16} />
                Remove
              </button>
            </div>
            <img
              src={preview}
              alt="UPI payment screenshot"
              className="mx-auto max-h-[400px] rounded-xl object-contain"
            />
            <button
              onClick={scanImage}
              disabled={scanning}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 font-semibold disabled:opacity-50"
            >
              {scanning ? (
                <Loader2 className="animate-spin" size={19} />
              ) : (
                <ScanLine size={19} />
              )}
              {scanning ? "Scanning..." : "Detect Transaction Details"}
            </button>
            {scanning && (
              <div className="mt-4">
                <div className="mb-2 flex justify-between text-xs text-gray-400">
                  <span>Recognizing text</span>
                  <span>{scanProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {/* Extracted details */}
        {ocrText && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-white/10 bg-[#10111b] p-4">
              <h3 className="mb-3 font-semibold">
                Detected transaction details
              </h3>
              <div className="mb-4 rounded-xl bg-white/5 p-3 text-sm">
                {paymentStatus === "success" ? (
                  <p className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 size={18} />
                    Success wording detected — verify independently
                  </p>
                ) : paymentStatus === "failed" ? (
                  <p className="flex items-center gap-2 text-red-400">
                    <AlertTriangle size={18} />
                    Failed or reversed wording detected
                  </p>
                ) : paymentStatus === "pending" ? (
                  <p className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle size={18} />
                    Pending wording detected
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle size={18} />
                    Payment status not identified
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  OCR cannot verify the actual payment with the bank or UPI
                  network.
                </p>
              </div>
              <form onSubmit={saveScannedExpense} className="space-y-4">
                <Field label="Amount (₹)">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={detectedAmount}
                    onChange={(e) => setDetectedAmount(e.target.value)}
                    className="field"
                  />
                </Field>
                <Field label="Merchant / Description">
                  <input
                    required
                    value={detectedMerchant}
                    onChange={(e) => setDetectedMerchant(e.target.value)}
                    placeholder="Enter merchant or description"
                    className="field"
                  />
                </Field>
                <Field label="Payment application">
                  <input
                    value={detectedApp}
                    onChange={(e) => setDetectedApp(e.target.value)}
                    className="field"
                  />
                </Field>
                <Field label="UPI Reference / UTR (if detected)">
                  <input
                    value={detectedReference}
                    onChange={(e) => setDetectedReference(e.target.value)}
                    placeholder="Reference number"
                    className="field"
                  />
                </Field>
                <Field label="Transaction date">
                  <input
                    type="date"
                    required
                    value={detectedDate}
                    onChange={(e) => setDetectedDate(e.target.value)}
                    className="field"
                  />
                </Field>
                <Field label="Suggested expense category">
                  <select
                    value={detectedCategory}
                    onChange={(e) => setDetectedCategory(e.target.value)}
                    className="field"
                  >
                    {expenseCategories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </Field>
                <button
                  type="submit"
                  disabled={
                    saving ||
                    scanning ||
                    paymentStatus === "failed" ||
                    paymentStatus === "pending"
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-semibold hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                  Confirm and Add to Expenses
                </button>
              </form>
            </div>
            <details className="rounded-xl border border-white/10 p-4">
              <summary className="cursor-pointer text-sm text-gray-400">
                View raw OCR text
              </summary>
              <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-xs text-gray-400">
                {ocrText}
              </pre>
            </details>
          </div>
        )}
        {scanStatus && (
          <p className="mt-4 text-sm text-gray-400">{scanStatus}</p>
        )}
      </section>
      {/* Transaction history */}
      <section className="rounded-2xl border border-white/10 bg-[#151722] p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Recent Transactions</h2>
            <p className="text-xs text-gray-500">
              {filteredTransactions.length} transactions
            </p>
          </div>
          <button
            onClick={() => void loadTransactions()}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10"
            title="Refresh"
          >
            <RefreshCw size={17} />
          </button>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {(["all", "income", "expense"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded-lg px-4 py-2 text-sm capitalize ${
                tab === item
                  ? "bg-violet-600 text-white"
                  : "bg-white/5 text-gray-400"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="relative mb-5">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="field pl-10"
          />
        </div>
        {loading ? (
          <p className="py-10 text-center text-gray-400">
            Loading transactions...
          </p>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet size={35} className="mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400">No transactions found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-xl p-3 ${
                      item.type === "income"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {item.type === "income" ? (
                      <ArrowDownLeft size={20} />
                    ) : (
                      <ArrowUpRight size={20} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.category} · {item.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={
                      item.type === "income"
                        ? "font-semibold text-green-400"
                        : "font-semibold text-red-400"
                    }
                  >
                    {item.type === "income" ? "+" : "−"}
                    {money(item.amount)}
                  </span>
                  <button
                    onClick={() => void deleteTransaction(item)}
                    disabled={saving}
                    className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                    title="Delete transaction"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
function SummaryCard({
  title,
  amount,
  icon,
  color,
}: {
  title: string;
  amount: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151722] p-5">
      <div className={`mb-3 flex items-center gap-3 ${color}`}>
        {icon}
        <span className="text-gray-400">{title}</span>
      </div>
      <h2 className={`text-2xl font-bold ${color}`}>{money(amount)}</h2>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-gray-400">{label}</span>
      {children}
    </label>
  );
}
