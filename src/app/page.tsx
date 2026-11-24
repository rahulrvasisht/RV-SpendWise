"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Target,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Trash2,
  CalendarDays,
  Tag,
  RotateCcw,
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ---------------- TYPES ----------------

type TransactionType = "income" | "expense";

type Label = {
  id: string;
  name: string;
  color: string;
};

type Transaction = {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: TransactionType;
  labels: Label[];
};

// ---------------- CONSTANTS ----------------

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

const incomeCategories = [
  "Salary",
  "Freelance",
  "Business",
  "Investments",
  "Bonus",
  "Gifts",
  "Other Income",
];

const defaultLabels = [
  { name: "Essential", color: "#22c55e" },
  { name: "Personal", color: "#8b5cf6" },
  { name: "Work", color: "#3b82f6" },
  { name: "Emergency", color: "#ef4444" },
  { name: "Recurring", color: "#f59e0b" },
  { name: "One Time", color: "#ec4899" },
  { name: "Family", color: "#06b6d4" },
  { name: "Investment", color: "#14b8a6" },
];

const MONTHLY_BUDGET = 40000;

// ---------------- HELPERS ----------------

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(year, monthNumber - 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const details = error as Record<string, unknown>;

    const parts = [details.message, details.details, details.hint, details.code]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .map(String);

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown Supabase error.";
    }
  }

  return String(error);
}

// ---------------- SIDEBAR ----------------

function Sidebar() {
  const navigation = [
    { label: "Dashboard", icon: LayoutDashboard },
    { label: "Transactions", icon: ArrowLeftRight },
    { label: "Budgets", icon: Wallet },
    { label: "Analytics", icon: ChartNoAxesCombined },
    { label: "Savings Goals", icon: Target },
  ];

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 border-r border-white/10 bg-[#10111b] p-6 lg:flex lg:flex-col">
      <div className="mb-12 flex flex-col items-center gap-3">
        <Image
          src="/rvws-logo.png"
          alt="RV Since 2026 Logo"
          width={314}
          height={393}
          priority
          className="h-auto w-32 object-contain"
        />

        <div className="text-center">
          <h1 className="text-xl font-bold">RV SpendWise</h1>
          <p className="text-xs text-gray-500">Personal Finance</p>
        </div>
      </div>

      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
        Main Menu
      </p>

      <nav className="space-y-2">
        {navigation.map((item, index) => {
          const Icon = item.icon;

          return (
            <a
              key={item.label}
              href="#"
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
                index === 0
                  ? "bg-violet-600 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={19} />
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-6">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Settings size={19} />
          Settings
        </div>
      </div>
    </aside>
  );
}

// ---------------- SUMMARY CARD ----------------

function SummaryCard({
  title,
  amount,
  positive,
}: {
  title: string;
  amount: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#171824] p-5">
      <p className="text-sm text-gray-400">{title}</p>
      <h2 className="mt-3 text-2xl font-bold">{amount}</h2>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {positive ? (
          <ArrowUpRight size={15} className="text-emerald-400" />
        ) : (
          <ArrowDownRight size={15} className="text-rose-400" />
        )}

        <span className="text-gray-400">Selected period</span>
      </div>
    </div>
  );
}

// ---------------- CHART ----------------

function DashboardChart({
  data,
}: {
  data: { month: string; income: number; expenses: number }[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#171824] p-5">
      <h3 className="font-semibold">Financial Overview</h3>
      <p className="mt-1 text-xs text-gray-500">Income vs Expenses</p>

      <div className="mt-6 h-64 w-full">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Add transactions to view your analytics.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>

                <linearGradient
                  id="expenseGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#f472b6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#ffffff10" vertical={false} />

              <XAxis
                dataKey="month"
                stroke="#71717a"
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                stroke="#71717a"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₹${value / 1000}k`}
              />

              <Tooltip
                contentStyle={{
                  background: "#202130",
                  border: "1px solid #38384a",
                  borderRadius: "12px",
                  color: "#fff",
                }}
                formatter={(value) => [formatCurrency(Number(value)), ""]}
              />

              <Area
                type="monotone"
                dataKey="income"
                stroke="#a78bfa"
                strokeWidth={3}
                fill="url(#incomeGradient)"
              />

              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#f472b6"
                strokeWidth={3}
                fill="url(#expenseGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ---------------- MAIN DASHBOARD ----------------

export default function Home() {
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Transaction form
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const [transactionType, setTransactionType] =
    useState<TransactionType>("expense");

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & Dining");
  const [date, setDate] = useState(getTodayDate());
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Custom label form
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#8B5CF6");
  const [isAddingLabel, setIsAddingLabel] = useState(false);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedLabelFilter, setSelectedLabelFilter] = useState("all");

  // Budget
  const [budget, setBudget] = useState(MONTHLY_BUDGET);

  // Reset
  const [isResetting, setIsResetting] = useState(false);

  // ---------------- LOAD DATA ----------------

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function loadData() {
      try {
        setErrorMessage("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace("/login");
          return;
        }

        // Create predefined labels if they do not exist.
        const { error: seedError } = await supabase.from("labels").upsert(
          defaultLabels.map((label) => ({
            user_id: user.id,
            name: label.name,
            color: label.color,
          })),
          {
            onConflict: "user_id,name",
            ignoreDuplicates: true,
          },
        );

        if (seedError) {
          throw new Error(`Labels setup failed: ${getErrorMessage(seedError)}`);
        }

        // Load labels.
        const { data: labelData, error: labelError } = await supabase
          .from("labels")
          .select("id, name, color")
          .order("name");

        if (labelError) {
          throw new Error(
            `Loading labels failed: ${getErrorMessage(labelError)}`,
          );
        }

        const loadedLabels: Label[] = (labelData ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          color: item.color,
        }));

        // Load expenses.
        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .select("id, description, amount, category, expense_date")
          .order("created_at", { ascending: false });

        if (expenseError) {
          throw new Error(
            `Loading expenses failed: ${getErrorMessage(expenseError)}`,
          );
        }

        // Load income.
        const { data: incomeData, error: incomeError } = await supabase
          .from("incomes")
          .select("id, description, amount, category, income_date")
          .order("created_at", { ascending: false });

        if (incomeError) {
          throw new Error(
            `Loading income failed: ${getErrorMessage(incomeError)}`,
          );
        }

        // Load transaction-label relationships.
        const { data: linkData, error: linkError } = await supabase
          .from("transaction_labels")
          .select("expense_id, income_id, label_id");

        if (linkError) {
          throw new Error(
            `Loading transaction labels failed: ${getErrorMessage(linkError)}`,
          );
        }

        const loadedTransactions: Transaction[] = [
          ...(expenseData ?? []).map((item) => ({
            id: item.id,
            name: item.description,
            category: item.category,
            date: item.expense_date,
            amount: Number(item.amount),
            type: "expense" as const,
            labels: (linkData ?? [])
              .filter((link) => link.expense_id === item.id)
              .map((link) =>
                loadedLabels.find((label) => label.id === link.label_id),
              )
              .filter((label): label is Label => Boolean(label)),
          })),

          ...(incomeData ?? []).map((item) => ({
            id: item.id,
            name: item.description,
            category: item.category,
            date: item.income_date,
            amount: Number(item.amount),
            type: "income" as const,
            labels: (linkData ?? [])
              .filter((link) => link.income_id === item.id)
              .map((link) =>
                loadedLabels.find((label) => label.id === link.label_id),
              )
              .filter((label): label is Label => Boolean(label)),
          })),
        ];

        loadedTransactions.sort((a, b) => b.date.localeCompare(a.date));

        if (!cancelled) {
          setLabels(loadedLabels);
          setTransactions(loadedTransactions);
        }
      } catch (error: unknown) {
        console.log("Dashboard loading error:", error);

        if (!cancelled) {
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // ---------------- OPEN TRANSACTION FORM ----------------

  function openTransactionForm(type: TransactionType) {
    setTransactionType(type);
    setDescription("");
    setAmount("");
    setCategory(
      type === "expense" ? expenseCategories[0] : incomeCategories[0],
    );
    setDate(getTodayDate());
    setSelectedLabelIds([]);
    setIsTransactionOpen(true);
  }

  // ---------------- TOGGLE LABEL ----------------

  function toggleLabel(labelId: string) {
    setSelectedLabelIds((previous) =>
      previous.includes(labelId)
        ? previous.filter((id) => id !== labelId)
        : [...previous, labelId],
    );
  }

  // ---------------- ADD TRANSACTION ----------------

  async function handleAddTransaction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const numericAmount = Number(amount);

    if (
      !description.trim() ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !date
    ) {
      alert("Please enter valid transaction details.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/login");
        return;
      }

      let savedTransaction: Transaction;

      if (transactionType === "expense") {
        const { data, error } = await supabase
          .from("expenses")
          .insert({
            description: description.trim(),
            amount: numericAmount,
            category,
            expense_date: date,
          })
          .select("id, description, amount, category, expense_date")
          .single();

        if (error) throw error;

        savedTransaction = {
          id: data.id,
          name: data.description,
          amount: Number(data.amount),
          category: data.category,
          date: data.expense_date,
          type: "expense",
          labels: [],
        };
      } else {
        const { data, error } = await supabase
          .from("incomes")
          .insert({
            description: description.trim(),
            amount: numericAmount,
            category,
            income_date: date,
          })
          .select("id, description, amount, category, income_date")
          .single();

        if (error) throw error;

        savedTransaction = {
          id: data.id,
          name: data.description,
          amount: Number(data.amount),
          category: data.category,
          date: data.income_date,
          type: "income",
          labels: [],
        };
      }

      // Attach selected labels.
      if (selectedLabelIds.length > 0) {
        const relationshipRows = selectedLabelIds.map((labelId) => ({
          user_id: user.id,
          expense_id:
            transactionType === "expense" ? savedTransaction.id : null,
          income_id: transactionType === "income" ? savedTransaction.id : null,
          label_id: labelId,
        }));

        const { error: labelLinkError } = await supabase
          .from("transaction_labels")
          .insert(relationshipRows);

        if (labelLinkError) {
          throw new Error(
            `Transaction saved, but labels could not be attached: ${getErrorMessage(labelLinkError)}`,
          );
        }

        savedTransaction.labels = labels.filter((label) =>
          selectedLabelIds.includes(label.id),
        );
      }

      setTransactions((previous) => [savedTransaction, ...previous]);
      setIsTransactionOpen(false);
      setDescription("");
      setAmount("");
      setSelectedLabelIds([]);
    } catch (error: unknown) {
      console.log("Unable to save transaction:", error);
      alert(getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------- DELETE TRANSACTION ----------------

  async function handleDeleteTransaction(transaction: Transaction) {
    const confirmed = window.confirm(
      `Are you sure you want to delete this ${transaction.type}?`,
    );

    if (!confirmed) return;

    try {
      const supabase = createClient();

      if (transaction.type === "expense") {
        const { error } = await supabase
          .from("expenses")
          .delete()
          .eq("id", transaction.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("incomes")
          .delete()
          .eq("id", transaction.id);

        if (error) throw error;
      }

      setTransactions((previous) =>
        previous.filter((item) => item.id !== transaction.id),
      );
    } catch (error: unknown) {
      console.log("Unable to delete transaction:", error);
      alert(getErrorMessage(error));
    }
  }

  // ---------------- RESET ALL ----------------

  async function handleResetAll() {
    const confirmed = window.confirm(
      "WARNING: This will permanently delete ALL your income and expense records.\n\nYour custom labels will be kept, but your dashboard data and filters will be reset.\n\nAre you sure you want to continue?",
    );

    if (!confirmed) return;

    const finalConfirmation = window.confirm(
      "Final confirmation: Delete all your income and expense records?",
    );

    if (!finalConfirmation) return;

    setIsResetting(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/login");
        return;
      }

      // 1. Delete the user's transaction-label relationships first.
      const { error: linkError } = await supabase
        .from("transaction_labels")
        .delete()
        .eq("user_id", user.id);

      if (linkError) {
        throw new Error(
          `Could not reset transaction labels: ${getErrorMessage(linkError)}`,
        );
      }

      // 2. Delete all expenses visible to this signed-in user under RLS.
      const { error: expenseError } = await supabase
        .from("expenses")
        .delete()
        .not("id", "is", null);

      if (expenseError) {
        throw new Error(
          `Could not delete expenses: ${getErrorMessage(expenseError)}`,
        );
      }

      // 3. Delete all income visible to this signed-in user under RLS.
      const { error: incomeError } = await supabase
        .from("incomes")
        .delete()
        .not("id", "is", null);

      if (incomeError) {
        throw new Error(
          `Could not delete income: ${getErrorMessage(incomeError)}`,
        );
      }

      // 4. Reset dashboard state.
      setTransactions([]);
      setSelectedMonth("all");
      setSelectedLabelFilter("all");
      setBudget(MONTHLY_BUDGET);

      // 5. Reset any open transaction form.
      setIsTransactionOpen(false);
      setDescription("");
      setAmount("");
      setCategory(expenseCategories[0]);
      setDate(getTodayDate());
      setSelectedLabelIds([]);

      alert("RV SpendWise has been successfully reset!");
    } catch (error: unknown) {
      console.log("Reset failed:", error);

      const message = getErrorMessage(error);
      setErrorMessage(`Reset failed: ${message}`);
      alert(`Unable to reset RV SpendWise:\n${message}`);
    } finally {
      setIsResetting(false);
    }
  }

  // ---------------- CREATE CUSTOM LABEL ----------------

  async function handleCreateLabel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanName = newLabelName.trim();

    if (!cleanName) {
      alert("Enter a label name.");
      return;
    }

    if (
      labels.some(
        (label) => label.name.toLowerCase() === cleanName.toLowerCase(),
      )
    ) {
      alert("This label already exists.");
      return;
    }

    setIsAddingLabel(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("labels")
        .insert({
          user_id: user.id,
          name: cleanName,
          color: newLabelColor,
        })
        .select("id, name, color")
        .single();

      if (error) throw error;

      setLabels((previous) =>
        [...previous, data].sort((a, b) => a.name.localeCompare(b.name)),
      );

      setNewLabelName("");
      setNewLabelColor("#8B5CF6");

      alert("Label created successfully!");
    } catch (error: unknown) {
      console.log("Unable to create label:", error);
      alert(getErrorMessage(error));
    } finally {
      setIsAddingLabel(false);
    }
  }

  // ---------------- FILTER TRANSACTIONS ----------------

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchesMonth =
        selectedMonth === "all" || getMonthKey(item.date) === selectedMonth;

      const matchesLabel =
        selectedLabelFilter === "all" ||
        item.labels.some((label) => label.id === selectedLabelFilter);

      return matchesMonth && matchesLabel;
    });
  }, [transactions, selectedMonth, selectedLabelFilter]);

  // ---------------- CALCULATE TOTALS ----------------

  const totalExpenses = filteredTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const totalIncome = filteredTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const savings = totalIncome - totalExpenses;

  // ---------------- CATEGORY BREAKDOWN ----------------

  const categoryTotals = expenseCategories
    .map((item) => ({
      name: item,
      total: filteredTransactions
        .filter(
          (transaction) =>
            transaction.category === item && transaction.type === "expense",
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    }))
    .filter((item) => item.total > 0);

  // ---------------- CHART DATA ----------------

  const chartData = useMemo(() => {
    const months = Array.from(
      new Set(transactions.map((item) => getMonthKey(item.date))),
    ).sort();

    return months.map((month) => {
      const monthTransactions = transactions.filter(
        (item) => getMonthKey(item.date) === month,
      );

      return {
        month: getMonthLabel(month),
        income: monthTransactions
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + item.amount, 0),
        expenses: monthTransactions
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + item.amount, 0),
      };
    });
  }, [transactions]);

  // ---------------- MONTH OPTIONS ----------------

  const monthOptions = Array.from(
    new Set(transactions.map((item) => getMonthKey(item.date))),
  ).sort((a, b) => b.localeCompare(a));

  const budgetPercentage =
    budget > 0 ? Math.min((totalExpenses / budget) * 100, 100) : 0;

  // ---------------- LOADING ----------------

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0c0d14] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading RVWS tracker</p>
        </div>
      </main>
    );
  }

  // ---------------- RENDER ----------------

  return (
    <main className="flex min-h-screen bg-[#0c0d14] text-white">
      {/* ADD INCOME / EXPENSE MODAL */}

      {isTransactionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-6 w-full max-w-lg rounded-2xl border border-white/10 bg-[#171824] p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Add {transactionType === "expense" ? "Expense" : "Income"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Enter your transaction details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsTransactionOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTransactionType("expense");
                  setCategory(expenseCategories[0]);
                  setSelectedLabelIds([]);
                }}
                className={`rounded-xl p-3 text-sm font-semibold ${
                  transactionType === "expense"
                    ? "bg-rose-600 text-white"
                    : "bg-white/5 text-gray-400"
                }`}
              >
                Add Expense
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransactionType("income");
                  setCategory(incomeCategories[0]);
                  setSelectedLabelIds([]);
                }}
                className={`rounded-xl p-3 text-sm font-semibold ${
                  transactionType === "income"
                    ? "bg-emerald-600 text-white"
                    : "bg-white/5 text-gray-400"
                }`}
              >
                Add Income
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Description
                </label>

                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    transactionType === "expense"
                      ? "e.g. Dinner with friends"
                      : "e.g. Monthly salary"
                  }
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#0c0d14] p-3 outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Amount (₹)
                </label>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#0c0d14] p-3 outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0c0d14] p-3 outline-none"
                >
                  {(transactionType === "expense"
                    ? expenseCategories
                    : incomeCategories
                  ).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">Date</label>

                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#0c0d14] p-3 outline-none"
                />
              </div>

              {/* LABEL SELECTION */}

              <div>
                <label className="mb-3 flex items-center gap-2 text-sm text-gray-400">
                  <Tag size={16} />
                  Labels
                </label>

                {labels.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No labels available yet. Create one below.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label) => {
                      const selected = selectedLabelIds.includes(label.id);

                      return (
                        <button
                          key={label.id}
                          type="button"
                          onClick={() => toggleLabel(label.id)}
                          className={`rounded-full border px-3 py-2 text-xs transition ${
                            selected
                              ? "border-white/40 bg-white/10 text-white"
                              : "border-white/10 bg-[#0c0d14] text-gray-400"
                          }`}
                          style={
                            selected
                              ? {
                                  borderColor: label.color,
                                  color: label.color,
                                }
                              : {}
                          }
                        >
                          {selected ? "✓ " : ""}
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="mt-2 text-xs text-gray-500">
                  You can select multiple labels.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className={`w-full rounded-xl p-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                  transactionType === "expense"
                    ? "bg-violet-600 hover:bg-violet-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isSaving
                  ? "Saving..."
                  : `Save ${
                      transactionType === "expense" ? "Expense" : "Income"
                    }`}
              </button>
            </form>
          </div>
        </div>
      )}

      <Sidebar />

      <div className="min-w-0 flex-1 p-5 sm:p-8">
        {/* HEADER */}

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>

            <p className="mt-1 text-sm text-gray-500">
              Track your money across every month.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* RESET ALL BUTTON */}

            <button
              type="button"
              onClick={handleResetAll}
              disabled={isResetting}
              className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw
                size={17}
                className={isResetting ? "animate-spin" : ""}
              />

              {isResetting ? "Resetting..." : "Reset All"}
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 font-bold">
              RV
            </div>
          </div>
        </header>

        {/* ERROR */}

        {errorMessage && (
          <div className="mb-6 break-words rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            <p className="font-semibold">Unable to load dashboard:</p>

            <p className="mt-2">{errorMessage}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* MONTH AND LABEL FILTERS */}

        <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#171824] p-5">
          <div>
            <h2 className="font-semibold">Financial Period</h2>

            <p className="mt-1 text-xs text-gray-500">
              Filter your transaction history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CalendarDays size={18} className="text-violet-400" />

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#0c0d14] p-3 text-sm outline-none"
            >
              <option value="all">All Time</option>

              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {getMonthLabel(month)}
                </option>
              ))}
            </select>

            <select
              value={selectedLabelFilter}
              onChange={(e) => setSelectedLabelFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-[#0c0d14] p-3 text-sm outline-none"
            >
              <option value="all">All Labels</option>

              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* SUMMARY */}

        <section className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-5">
            <p className="text-sm text-violet-100">Total Balance</p>

            <h2 className="mt-3 text-3xl font-bold">
              {formatCurrency(savings)}
            </h2>

            <p className="mt-3 text-xs text-violet-100">
              Income minus expenses
            </p>
          </div>

          <SummaryCard
            title="Total Income"
            amount={formatCurrency(totalIncome)}
            positive
          />

          <SummaryCard
            title="Total Expenses"
            amount={formatCurrency(totalExpenses)}
            positive={false}
          />

          <SummaryCard
            title="Net Savings"
            amount={formatCurrency(savings)}
            positive={savings >= 0}
          />
        </section>

        {/* CHART AND BUDGET */}

        <section className="mb-8 grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <DashboardChart data={chartData} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#171824] p-5">
            <h3 className="font-semibold">Monthly Budget</h3>

            <p className="mt-8 text-sm text-gray-400">
              Spending in selected period
            </p>

            <h2 className="mt-2 text-3xl font-bold">
              {formatCurrency(totalExpenses)}
            </h2>

            <p className="mt-2 text-xs text-gray-500">
              Budget: {formatCurrency(budget)}
            </p>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${budgetPercentage}%` }}
              />
            </div>

            <div className="mt-4 flex justify-between text-xs">
              <span className="text-gray-400">
                {Math.round(budgetPercentage)}% used
              </span>

              <span className="text-emerald-400">
                {formatCurrency(Math.max(0, budget - totalExpenses))} left
              </span>
            </div>

            <label className="mt-6 block text-xs text-gray-400">
              Set budget (₹)
            </label>

            <input
              type="number"
              min="1"
              value={budget}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value > 0) setBudget(value);
              }}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0c0d14] p-3 text-sm outline-none"
            />
          </div>
        </section>

        {/* TRANSACTIONS AND QUICK ACTIONS */}

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#171824] p-5">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-semibold">Transactions</h3>

              <span className="text-xs text-gray-500">
                {filteredTransactions.length} records
              </span>
            </div>

            <div className="space-y-5">
              {filteredTransactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  No transactions found for this period.
                </p>
              ) : (
                filteredTransactions.map((transaction) => (
                  <div
                    key={`${transaction.type}-${transaction.id}`}
                    className="flex items-center justify-between gap-3 border-b border-white/5 pb-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {transaction.name}
                      </p>

                      <p className="mt-1 text-xs text-violet-400">
                        {transaction.category}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {transaction.date}
                      </p>

                      {transaction.labels.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {transaction.labels.map((label) => (
                            <span
                              key={label.id}
                              className="rounded-full border px-2 py-1 text-[10px]"
                              style={{
                                color: label.color,
                                borderColor: `${label.color}66`,
                                backgroundColor: `${label.color}15`,
                              }}
                            >
                              #{label.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <p
                        className={`text-sm font-semibold ${
                          transaction.type === "income"
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleDeleteTransaction(transaction)}
                        className="rounded-lg p-2 text-gray-500 hover:text-rose-400"
                        aria-label="Delete transaction"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* QUICK ACTIONS */}

          <div className="rounded-2xl border border-white/10 bg-[#171824] p-5">
            <h3 className="font-semibold">Quick Actions</h3>

            <p className="mt-2 text-sm text-gray-500">
              Manage your income and expenses.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => openTransactionForm("expense")}
                className="rounded-xl bg-violet-600 p-5 text-left hover:bg-violet-700"
              >
                <Plus size={22} />
                <p className="mt-4 text-sm font-semibold">Add Expense</p>
              </button>

              <button
                type="button"
                onClick={() => openTransactionForm("income")}
                className="rounded-xl bg-emerald-600 p-5 text-left hover:bg-emerald-700"
              >
                <Plus size={22} />
                <p className="mt-4 text-sm font-semibold">Add Income</p>
              </button>
            </div>
          </div>
        </section>

        {/* LABEL MANAGEMENT */}

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#171824] p-5">
          <div className="mb-5 flex items-center gap-2">
            <Tag size={19} className="text-violet-400" />
            <h3 className="font-semibold">Manage Labels</h3>
          </div>

          <p className="mb-5 text-sm text-gray-500">
            Use predefined labels or create your own labels to organize
            transactions.
          </p>

          <div className="mb-6 flex flex-wrap gap-2">
            {labels.map((label) => (
              <span
                key={label.id}
                className="rounded-full border px-3 py-2 text-xs"
                style={{
                  color: label.color,
                  borderColor: `${label.color}66`,
                  backgroundColor: `${label.color}15`,
                }}
              >
                #{label.name}
              </span>
            ))}
          </div>

          <form
            onSubmit={handleCreateLabel}
            className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"
          >
            <input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Create a custom label..."
              className="min-w-0 rounded-xl border border-white/10 bg-[#0c0d14] p-3 text-sm outline-none focus:border-violet-500"
            />

            <input
              type="color"
              value={newLabelColor}
              onChange={(e) => setNewLabelColor(e.target.value)}
              aria-label="Choose label color"
              className="h-11 w-full cursor-pointer rounded-xl border border-white/10 bg-[#0c0d14] p-1 sm:w-14"
            />

            <button
              type="submit"
              disabled={isAddingLabel}
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              <Plus size={17} />
              {isAddingLabel ? "Adding..." : "Create Label"}
            </button>
          </form>
        </section>

        {/* CATEGORY BREAKDOWN */}

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#171824] p-5">
          <h3 className="mb-5 font-semibold">Expense Category Breakdown</h3>

          {categoryTotals.length === 0 ? (
            <p className="text-sm text-gray-500">
              Add expenses to see category statistics.
            </p>
          ) : (
            <div className="space-y-5">
              {categoryTotals.map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{item.name}</span>

                    <span className="text-gray-400">
                      {formatCurrency(item.total)}
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-violet-500"
                      style={{
                        width: `${
                          totalExpenses > 0
                            ? (item.total / totalExpenses) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-white/10 pt-5 text-center text-xs text-gray-600">
          © 2026 RV SpendWise. Manage your money smarter.
        </footer>
      </div>
    </main>
  );
}
