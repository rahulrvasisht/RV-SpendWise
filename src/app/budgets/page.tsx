"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Wallet,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";

type Budget = {
  id?: string;
  user_id: string;
  month_start: string;
  category: string;
  budget_amount: number;
  rollover_amount: number;
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: string;
  expense_date: string;
};

const defaultCategories = [
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

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthStart(month: string) {
  return `${month}-01`;
}

function getPreviousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 2, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default function BudgetsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [selectedMonth, setSelectedMonth] = useState("");
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rollingOver, setRollingOver] = useState(false);
  const [error, setError] = useState("");

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [editingCategory, setEditingCategory] = useState("");

  const [customCategory, setCustomCategory] = useState(false);

  // Read the current date only after the component mounts in the browser.
  useEffect(() => {
    setSelectedMonth(getCurrentMonth());
  }, []);

  const monthStart = selectedMonth ? getMonthStart(selectedMonth) : "";
  const nextMonth = selectedMonth
    ? getMonthStart(
        (() => {
          const [year, month] = selectedMonth.split("-").map(Number);
          const date = new Date(year, month, 1);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        })(),
      )
    : "";

  const previousMonthValue = selectedMonth
    ? getPreviousMonth(selectedMonth)
    : "";
  const previousMonth = previousMonthValue
    ? getMonthStart(previousMonthValue)
    : "";
  const previousMonthLabel = previousMonthValue
    ? formatMonth(previousMonthValue)
    : "";
  const currentMonthLabel = selectedMonth ? formatMonth(selectedMonth) : "";

  /* LOAD BUDGETS AND EXPENSES */

  const loadData = useCallback(async () => {
    if (!monthStart) return;

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
        { data: budgetData, error: budgetError },
        { data: expenseData, error: expenseError },
      ] = await Promise.all([
        supabase
          .from("category_budgets")
          .select("*")
          .eq("user_id", user.id)
          .eq("month_start", monthStart)
          .order("category"),

        supabase
          .from("expenses")
          .select("id, description, amount, category, expense_date")
          .gte("expense_date", monthStart)
          .lt("expense_date", nextMonth),
      ]);

      if (budgetError) throw budgetError;
      if (expenseError) throw expenseError;

      setBudgets(
        (budgetData ?? []).map((item) => ({
          ...item,
          budget_amount: Number(item.budget_amount),
          rollover_amount: Number(item.rollover_amount),
        })),
      );

      setExpenses(
        (expenseData ?? []).map((item) => ({
          ...item,
          amount: Number(item.amount),
        })),
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load budget information.",
      );
    } finally {
      setLoading(false);
    }
  }, [monthStart, nextMonth, router, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* CALCULATIONS */

  const totalBudget = budgets.reduce(
    (sum, item) => sum + item.budget_amount + item.rollover_amount,
    0,
  );

  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);

  const remaining = totalBudget - totalSpent;

  const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const categorySpending = expenses.reduce(
    (result, expense) => {
      const name = expense.category || "Other";

      result[name] = (result[name] || 0) + expense.amount;

      return result;
    },
    {} as Record<string, number>,
  );

  const categoryOptions = Array.from(
    new Set([
      ...defaultCategories,
      ...budgets.map((item) => item.category),
      ...expenses.map((item) => item.category || "Other"),
    ]),
  );

  const isOverBudget = totalSpent > totalBudget;

  /* ADD OR UPDATE BUDGET */

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanCategory = category.trim();
    const budgetValue = Number(amount);

    if (!cleanCategory) {
      alert("Please enter a category.");
      return;
    }

    if (!Number.isFinite(budgetValue) || budgetValue < 0) {
      alert("Please enter a valid budget amount.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please log in again.");

      const { error: saveError } = await supabase
        .from("category_budgets")
        .upsert(
          {
            user_id: user.id,
            month_start: monthStart,
            category: cleanCategory,
            budget_amount: budgetValue,
            rollover_amount: editingCategory
              ? (budgets.find((item) => item.category === editingCategory)
                  ?.rollover_amount ?? 0)
              : (budgets.find((item) => item.category === cleanCategory)
                  ?.rollover_amount ?? 0),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,month_start,category",
          },
        );

      if (saveError) throw saveError;

      setCategory("");
      setAmount("");
      setEditingCategory("");
      setCustomCategory(false);

      await loadData();
    } catch (err) {
      console.error(err);

      setError(err instanceof Error ? err.message : "Unable to save budget.");
    } finally {
      setSaving(false);
    }
  }

  /* EDIT BUDGET */

  function editBudget(item: Budget) {
    setCategory(item.category);
    setAmount(String(item.budget_amount));
    setEditingCategory(item.category);
    setCustomCategory(!defaultCategories.includes(item.category));

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* DELETE BUDGET */

  async function deleteBudget(item: Budget) {
    if (
      !window.confirm(
        `Delete the ${item.category} budget for ${currentMonthLabel}?`,
      )
    ) {
      return;
    }

    setSaving(true);

    try {
      const { error: deleteError } = await supabase
        .from("category_budgets")
        .delete()
        .eq("id", item.id)
        .eq("month_start", monthStart);

      if (deleteError) throw deleteError;

      await loadData();
    } catch (err) {
      console.error(err);
      setError("Unable to delete budget.");
    } finally {
      setSaving(false);
    }
  }

  /* ROLLOVER UNUSED MONEY */

  async function applyRollover() {
    const confirmed = window.confirm(
      `Carry unused category budgets from ${previousMonthLabel} into ${currentMonthLabel}?`,
    );

    if (!confirmed) return;

    setRollingOver(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Please log in again.");

      const [
        { data: previousBudgets, error: previousBudgetError },
        { data: previousExpenses, error: previousExpenseError },
      ] = await Promise.all([
        supabase
          .from("category_budgets")
          .select("*")
          .eq("user_id", user.id)
          .eq("month_start", previousMonth),

        supabase
          .from("expenses")
          .select("amount, category")
          .gte("expense_date", previousMonth)
          .lt("expense_date", monthStart),
      ]);

      if (previousBudgetError) throw previousBudgetError;
      if (previousExpenseError) throw previousExpenseError;

      if (!previousBudgets || previousBudgets.length === 0) {
        alert(`No category budgets were found for ${previousMonthLabel}.`);
        return;
      }

      const previousSpending = (previousExpenses ?? []).reduce(
        (result, expense) => {
          const name = expense.category || "Other";

          result[name] = (result[name] || 0) + Number(expense.amount);

          return result;
        },
        {} as Record<string, number>,
      );

      const currentBudgets = new Map(
        budgets.map((item) => [item.category, item]),
      );

      const rolloverRows = previousBudgets.map((item) => {
        const oldBudget = Number(item.budget_amount);
        const oldRollover = Number(item.rollover_amount);

        const spent = previousSpending[item.category] || 0;

        const unused = Math.max(0, oldBudget + oldRollover - spent);

        const current = currentBudgets.get(item.category);

        return {
          user_id: user.id,
          month_start: monthStart,
          category: item.category,
          budget_amount: current?.budget_amount ?? 0,
          rollover_amount: unused,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: rolloverError } = await supabase
        .from("category_budgets")
        .upsert(rolloverRows, {
          onConflict: "user_id,month_start,category",
        });

      if (rolloverError) throw rolloverError;

      await loadData();

      alert(
        `Unused budget from ${previousMonthLabel} has been carried forward.`,
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error ? err.message : "Unable to apply budget rollover.",
      );
    } finally {
      setRollingOver(false);
    }
  }

  /* CANCEL EDIT */

  function cancelEdit() {
    setCategory("");
    setAmount("");
    setEditingCategory("");
    setCustomCategory(false);
  }

  /* MONTH NAVIGATION */

  function changeMonth(direction: number) {
    const [year, month] = selectedMonth.split("-").map(Number);

    const date = new Date(year, month - 1 + direction, 1);

    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    );

    cancelEdit();
  }

  return (
    <main className="min-h-screen bg-[#0c0d14] p-5 text-white md:p-8">
      {/* HEADER */}

      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-xl border border-white/10 p-3 hover:bg-white/10"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h1 className="text-2xl font-bold">Budget Management</h1>
            <p className="text-sm text-gray-400">
              Plan your spending and manage your money
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400">
          <Wallet size={18} />
          RV SpendWise
        </div>
      </header>

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
          <button onClick={() => setError("")}>
            <X size={17} />
          </button>
        </div>
      )}

      {/* MONTH SELECTOR */}

      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#151722] p-4">
        <div>
          <p className="text-xs text-gray-500">SELECT MONTH</p>
          <h2 className="mt-1 text-lg font-semibold">{currentMonthLabel}</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded-lg border border-white/10 p-2 hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft size={19} />
          </button>

          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => {
              if (event.target.value) {
                setSelectedMonth(event.target.value);
                cancelEdit();
              }
            }}
            className="rounded-lg border border-white/10 bg-[#10111b] px-3 py-2 text-sm text-white"
          />

          <button
            onClick={() => changeMonth(1)}
            className="rounded-lg border border-white/10 p-2 hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-[350px] items-center justify-center gap-3 text-gray-400">
          <Loader2 className="animate-spin" />
          Loading your budgets...
        </div>
      ) : (
        <>
          {/* DASHBOARD CARDS */}

          <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Total Budget"
              value={formatMoney(totalBudget)}
              icon={<Wallet size={21} />}
              color="text-violet-400"
            />

            <SummaryCard
              title="Total Spent"
              value={formatMoney(totalSpent)}
              icon={<TrendingDown size={21} />}
              color="text-red-400"
            />

            <SummaryCard
              title="Remaining Balance"
              value={formatMoney(remaining)}
              icon={<PiggyBank size={21} />}
              color={remaining >= 0 ? "text-green-400" : "text-red-400"}
            />

            <SummaryCard
              title="Budget Used"
              value={`${percentageUsed.toFixed(1)}%`}
              icon={<TrendingUp size={21} />}
              color="text-blue-400"
            />
          </section>

          {/* OVERALL PROGRESS */}

          <section className="mb-8 rounded-2xl border border-white/10 bg-[#151722] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Monthly Spending Progress</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Your spending compared with your category budgets
                </p>
              </div>

              {isOverBudget ? (
                <span className="flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  <AlertTriangle size={15} />
                  Budget exceeded
                </span>
              ) : (
                <span className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-2 text-xs text-green-400">
                  <CheckCircle2 size={15} />
                  Within budget
                </span>
              )}
            </div>

            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-400">
                {formatMoney(totalSpent)} spent
              </span>

              <span className="text-gray-400">
                {formatMoney(totalBudget)} available
              </span>
            </div>

            <div className="h-4 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverBudget ? "bg-red-500" : "bg-violet-500"
                }`}
                style={{
                  width: `${Math.min(percentageUsed, 100)}%`,
                }}
              />
            </div>

            <p className="mt-3 text-sm text-gray-400">
              {totalBudget === 0
                ? "Create your first category budget to start tracking."
                : isOverBudget
                  ? `You have exceeded your combined category budgets by ${formatMoney(Math.abs(remaining))}.`
                  : `${formatMoney(remaining)} remains across your configured category budgets.`}
            </p>
          </section>

          {/* ROLLOVER */}

          <section className="mb-8 rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-indigo-500/5 p-6">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div className="flex gap-4">
                <div className="h-fit rounded-xl bg-violet-500/15 p-3 text-violet-400">
                  <RotateCcw size={25} />
                </div>

                <div>
                  <h2 className="text-lg font-bold">Budget Rollover</h2>

                  <p className="mt-1 max-w-xl text-sm text-gray-400">
                    Carry unused category budget from {previousMonthLabel} into{" "}
                    {currentMonthLabel}. The previous month's remaining balance
                    is calculated separately for each category.
                  </p>
                </div>
              </div>

              <button
                onClick={() => void applyRollover()}
                disabled={rollingOver}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
              >
                {rollingOver ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <RefreshCw size={18} />
                )}

                {rollingOver ? "Applying..." : "Apply Rollover"}
              </button>
            </div>
          </section>

          {/* CATEGORY BUDGET FORM */}

          <section className="mb-8 rounded-2xl border border-white/10 bg-[#151722] p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-violet-500/15 p-3 text-violet-400">
                {editingCategory ? <Pencil size={21} /> : <Plus size={21} />}
              </div>

              <div>
                <h2 className="text-lg font-bold">
                  {editingCategory
                    ? "Edit Category Budget"
                    : "Create Category Budget"}
                </h2>

                <p className="text-sm text-gray-400">
                  Set your spending limit for each category
                </p>
              </div>
            </div>

            <form onSubmit={saveBudget} className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Category
                </label>

                {customCategory ? (
                  <input
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="Enter custom category"
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#10111b] px-4 py-3 outline-none focus:border-violet-500"
                  />
                ) : (
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#10111b] px-4 py-3 outline-none focus:border-violet-500"
                  >
                    <option value="">Select category</option>

                    {categoryOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                )}

                {!editingCategory && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomCategory(!customCategory);
                      setCategory("");
                    }}
                    className="mt-2 text-xs text-violet-400 hover:text-violet-300"
                  >
                    {customCategory
                      ? "Choose an existing category"
                      : "+ Create custom category"}
                  </button>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">
                  Monthly Budget (₹)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Example: 5000"
                  className="w-full rounded-xl border border-white/10 bg-[#10111b] px-4 py-3 outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}

                  {editingCategory ? "Update Budget" : "Add Budget"}
                </button>

                {editingCategory && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-xl border border-white/10 p-3 hover:bg-white/10"
                    title="Cancel edit"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* CATEGORY BUDGETS */}

          <section className="mb-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Category-wise Budgets</h2>

                <p className="mt-1 text-sm text-gray-400">
                  Track spending limits for individual categories
                </p>
              </div>

              <span className="rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-400">
                {budgets.length} categories
              </span>
            </div>

            {budgets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-[#151722] px-5 py-14 text-center">
                <PiggyBank size={38} className="mx-auto mb-4 text-violet-400" />

                <h3 className="mb-2 font-semibold">No budgets created yet</h3>

                <p className="text-sm text-gray-400">
                  Add your first category budget using the form above.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {budgets.map((item) => {
                  const spent = categorySpending[item.category] || 0;

                  const baseBudget = item.budget_amount;
                  const rollover = item.rollover_amount;
                  const available = baseBudget + rollover;

                  const percentage =
                    available > 0
                      ? (spent / available) * 100
                      : spent > 0
                        ? 100
                        : 0;

                  const remainingCategory = available - spent;

                  const over = spent > available;
                  const warning = percentage >= 80;

                  return (
                    <div
                      key={item.id ?? item.category}
                      className="rounded-2xl border border-white/10 bg-[#151722] p-5"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">{item.category}</h3>

                          <p className="mt-1 text-xs text-gray-500">
                            Base budget: {formatMoney(baseBudget)}
                          </p>

                          {rollover > 0 && (
                            <p className="mt-1 text-xs text-green-400">
                              Rollover: +{formatMoney(rollover)}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => editBudget(item)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                            title="Edit budget"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            onClick={() => void deleteBudget(item)}
                            disabled={saving}
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                            title="Delete budget"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mb-2 flex justify-between text-sm">
                        <span className="text-gray-400">
                          {formatMoney(spent)} spent
                        </span>

                        <span
                          className={over ? "text-red-400" : "text-gray-300"}
                        >
                          {percentage.toFixed(0)}%
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full transition-all ${
                            over
                              ? "bg-red-500"
                              : warning
                                ? "bg-yellow-500"
                                : "bg-violet-500"
                          }`}
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        />
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          Available: {formatMoney(available)}
                        </span>

                        <span
                          className={`text-sm font-semibold ${
                            remainingCategory < 0
                              ? "text-red-400"
                              : "text-green-400"
                          }`}
                        >
                          {remainingCategory < 0
                            ? `${formatMoney(Math.abs(remainingCategory))} over`
                            : `${formatMoney(remainingCategory)} left`}
                        </span>
                      </div>

                      {over && (
                        <p className="mt-3 flex items-center gap-2 text-xs text-red-400">
                          <AlertTriangle size={14} />
                          Category budget exceeded
                        </p>
                      )}

                      {!over && warning && (
                        <p className="mt-3 text-xs text-yellow-400">
                          You are approaching your spending limit.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* SPENDING INSIGHT */}

          <section className="rounded-2xl border border-white/10 bg-[#151722] p-6">
            <div className="mb-4 flex items-center gap-3">
              <TrendingUp className="text-violet-400" size={22} />

              <h2 className="text-lg font-bold">Budget Insights</h2>
            </div>

            {budgets.length === 0 ? (
              <p className="text-sm text-gray-400">
                Create category budgets to see spending insights.
              </p>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-gray-300">
                  You have configured <strong>{budgets.length}</strong> category
                  budgets with a combined available amount of{" "}
                  <strong>{formatMoney(totalBudget)}</strong>.
                </p>

                <p className="text-gray-300">
                  Your recorded spending for this month is{" "}
                  <strong>{formatMoney(totalSpent)}</strong>.
                </p>

                {isOverBudget ? (
                  <p className="flex items-center gap-2 text-red-400">
                    <AlertTriangle size={17} />
                    Your total recorded expenses exceed your configured category
                    budgets.
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 size={17} />
                    Your recorded spending is within your combined budget.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/* SUMMARY CARD */

function SummaryCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#151722] p-5">
      <div className={`mb-4 flex items-center justify-between ${color}`}>
        <span className="text-sm text-gray-400">{title}</span>
        {icon}
      </div>

      <h2 className="text-2xl font-bold">{value}</h2>
    </div>
  );
}
