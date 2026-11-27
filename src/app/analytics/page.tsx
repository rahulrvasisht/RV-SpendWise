"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Download,
  FileText,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  CalendarDays,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

/* TYPES */

type Transaction = {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  type: "income" | "expense";
};

type Budget = {
  id: string;
  category: string;
  month_start: string;
  budget_amount: number;
  rollover_amount: number;
};

type Period = "daily" | "monthly" | "yearly";

/* HELPERS */

const COLORS = [
  "#8B5CF6",
  "#06B6D4",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#3B82F6",
  "#F97316",
  "#A78BFA",
  "#14B8A6",
  "#EF4444",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function monthString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function monthStartString(date: Date) {
  return `${monthString(date)}-01`;
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function escapeCSV(value: string | number) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function sumAmounts(items: Transaction[]) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

function getPeriodStart(period: Period, today: Date) {
  if (period === "daily") {
    const date = new Date(today);
    date.setDate(date.getDate() - 29);
    return localDateString(date);
  }

  if (period === "monthly") {
    const date = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    return localDateString(date);
  }

  const date = new Date(today.getFullYear() - 4, 0, 1);
  return localDateString(date);
}

/* MAIN PAGE */

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const [period, setPeriod] = useState<Period>("monthly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [today, setToday] = useState<Date>(() => new Date(0));

  useEffect(() => {
    setToday(new Date());
  }, []);

  const todayString = localDateString(today);
  const currentMonthStart = monthStartString(today);

  /* LOAD REAL SUPABASE DATA */

  const loadAnalytics = useCallback(async () => {
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
        { data: expenseData, error: expenseError },
        { data: incomeData, error: incomeError },
        { data: budgetData, error: budgetError },
      ] = await Promise.all([
        supabase
          .from("expenses")
          .select("id, description, amount, category, expense_date"),

        supabase
          .from("incomes")
          .select("id, description, amount, category, income_date"),

        supabase
          .from("category_budgets")
          .select("id, category, month_start, budget_amount, rollover_amount")
          .eq("user_id", user.id),
      ]);

      if (expenseError) throw expenseError;
      if (incomeError) throw incomeError;
      if (budgetError) throw budgetError;

      const combined: Transaction[] = [
        ...(expenseData ?? []).map((item) => ({
          id: item.id,
          description: item.description ?? "Expense",
          amount: Number(item.amount) || 0,
          category: item.category || "Other",
          date: item.expense_date,
          type: "expense" as const,
        })),

        ...(incomeData ?? []).map((item) => ({
          id: item.id,
          description: item.description ?? "Income",
          amount: Number(item.amount) || 0,
          category: item.category || "Other",
          date: item.income_date,
          type: "income" as const,
        })),
      ];

      combined.sort((a, b) => b.date.localeCompare(a.date));

      setTransactions(combined);

      setBudgets(
        (budgetData ?? []).map((item) => ({
          ...item,
          budget_amount: Number(item.budget_amount) || 0,
          rollover_amount: Number(item.rollover_amount) || 0,
        })),
      );
    } catch (err) {
      console.error("Analytics loading error:", err);

      setError(
        err instanceof Error ? err.message : "Unable to load analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  /* SELECTED PERIOD */

  const periodTransactions = useMemo(() => {
    const start = getPeriodStart(period, today);

    return transactions.filter(
      (item) => item.date >= start && item.date <= todayString,
    );
  }, [transactions, period, today, todayString]);

  const incomeTransactions = periodTransactions.filter(
    (item) => item.type === "income",
  );

  const expenseTransactions = periodTransactions.filter(
    (item) => item.type === "expense",
  );

  /* OVERVIEW CALCULATIONS */

  const totalIncome = sumAmounts(incomeTransactions);
  const totalExpenses = sumAmounts(expenseTransactions);

  const netSavings = totalIncome - totalExpenses;

  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const averageDailyExpense =
    totalExpenses /
    (period === "daily" ? 30 : period === "monthly" ? 365 / 12 : 365);

  /* CATEGORY BREAKDOWN */

  const categoryData = useMemo(() => {
    const totals: Record<string, number> = {};

    expenseTransactions.forEach((item) => {
      totals[item.category] = (totals[item.category] || 0) + item.amount;
    });

    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseTransactions]);

  /* MONTHLY INCOME VS EXPENSES */

  const monthlyComparison = useMemo(() => {
    const result: {
      month: string;
      income: number;
      expenses: number;
    }[] = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);

      const key = monthString(date);

      const monthItems = transactions.filter((item) =>
        item.date.startsWith(key),
      );

      result.push({
        month: formatMonth(date),
        income: sumAmounts(monthItems.filter((item) => item.type === "income")),
        expenses: sumAmounts(
          monthItems.filter((item) => item.type === "expense"),
        ),
      });
    }

    return result;
  }, [transactions, todayString]);

  /* DAILY / MONTHLY / YEARLY TREND */

  const trendData = useMemo(() => {
    const result: {
      label: string;
      income: number;
      expenses: number;
      savings: number;
    }[] = [];

    let count = 30;

    if (period === "monthly") count = 12;
    if (period === "yearly") count = 5;

    for (let i = count - 1; i >= 0; i--) {
      let start: Date;
      let end: Date;
      let label: string;

      if (period === "daily") {
        start = new Date(today);
        start.setDate(today.getDate() - i);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
        label = formatDate(start);
      } else if (period === "monthly") {
        start = new Date(today.getFullYear(), today.getMonth() - i, 1);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        label = formatMonth(start);
      } else {
        start = new Date(today.getFullYear() - i, 0, 1);
        end = new Date(today.getFullYear() - i + 1, 0, 1);
        label = String(start.getFullYear());
      }

      const startKey = localDateString(start);
      const endKey = localDateString(end);

      const items = transactions.filter(
        (item) => item.date >= startKey && item.date < endKey,
      );

      const income = sumAmounts(items.filter((item) => item.type === "income"));

      const expenses = sumAmounts(
        items.filter((item) => item.type === "expense"),
      );

      result.push({
        label,
        income,
        expenses,
        savings: income - expenses,
      });
    }

    return result;
  }, [transactions, period, todayString]);

  /* SAVINGS TREND */

  const savingsTrend = useMemo(() => {
    return monthlyComparison.map((item) => ({
      month: item.month,
      savings: item.income - item.expenses,
    }));
  }, [monthlyComparison]);

  /* CURRENT MONTH BUDGET PERFORMANCE */

  const currentMonthBudgets = budgets.filter(
    (item) => item.month_start === currentMonthStart,
  );

  const currentMonthExpenses = transactions.filter(
    (item) =>
      item.type === "expense" &&
      item.date >= currentMonthStart &&
      item.date <= todayString,
  );

  const currentMonthBudgetTotal = currentMonthBudgets.reduce(
    (sum, item) => sum + item.budget_amount + item.rollover_amount,
    0,
  );

  const currentMonthSpent = sumAmounts(currentMonthExpenses);

  const currentMonthRemaining = currentMonthBudgetTotal - currentMonthSpent;

  const budgetPerformance = currentMonthBudgets.map((item) => {
    const spent = currentMonthExpenses
      .filter((expense) => expense.category === item.category)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const available = item.budget_amount + item.rollover_amount;

    return {
      category: item.category,
      available,
      spent,
      remaining: available - spent,
      percentage: available > 0 ? (spent / available) * 100 : 0,
    };
  });

  /* SMART INSIGHTS */

  const insights = useMemo(() => {
    const result: {
      title: string;
      description: string;
      type: "success" | "warning" | "info";
    }[] = [];

    if (periodTransactions.length === 0) {
      result.push({
        title: "No transaction data yet",
        description:
          "Add income and expenses to start receiving financial insights.",
        type: "info",
      });

      return result;
    }

    if (netSavings > 0) {
      result.push({
        title: "Positive savings",
        description: `You have saved ${formatMoney(netSavings)} during the selected period.`,
        type: "success",
      });
    } else if (netSavings < 0) {
      result.push({
        title: "Expenses exceed income",
        description:
          "Your recorded expenses are higher than your recorded income for this period.",
        type: "warning",
      });
    }

    if (totalIncome > 0) {
      result.push({
        title: "Savings rate",
        description: `Your savings rate is ${savingsRate.toFixed(1)}% for this period.`,
        type: savingsRate >= 20 ? "success" : "info",
      });
    }

    if (categoryData.length > 0) {
      const highest = categoryData[0];

      result.push({
        title: "Highest spending category",
        description: `${highest.name} accounts for ${formatMoney(highest.value)} of your recorded expenses.`,
        type: "info",
      });
    }

    const overBudget = budgetPerformance.filter(
      (item) => item.spent > item.available,
    );

    if (overBudget.length > 0) {
      result.push({
        title: "Category budgets exceeded",
        description: `${overBudget.map((item) => item.category).join(", ")} ${overBudget.length === 1 ? "has" : "have"} exceeded the configured budget.`,
        type: "warning",
      });
    } else if (currentMonthBudgets.length > 0) {
      result.push({
        title: "Budget performance",
        description: `You have ${formatMoney(Math.max(0, currentMonthRemaining))} remaining across your configured category budgets this month.`,
        type: currentMonthRemaining >= 0 ? "success" : "warning",
      });
    }

    if (monthlyComparison.length >= 2) {
      const previous = monthlyComparison[monthlyComparison.length - 2];
      const current = monthlyComparison[monthlyComparison.length - 1];

      if (previous.expenses > 0) {
        const change =
          ((current.expenses - previous.expenses) / previous.expenses) * 100;

        result.push({
          title: "Monthly expense comparison",
          description:
            change > 0
              ? `Expenses are ${change.toFixed(1)}% higher than last month.`
              : `Expenses are ${Math.abs(change).toFixed(1)}% lower than last month.`,
          type: change > 0 ? "warning" : "success",
        });
      }
    }

    return result;
  }, [
    periodTransactions,
    netSavings,
    totalIncome,
    savingsRate,
    categoryData,
    budgetPerformance,
    currentMonthBudgets.length,
    currentMonthRemaining,
    monthlyComparison,
  ]);

  /* CSV EXPORT */

  function exportCSV() {
    const rows = [
      ["Date", "Type", "Description", "Category", "Amount"],
      ...periodTransactions.map((item) => [
        item.date,
        item.type,
        item.description,
        item.category,
        item.amount.toFixed(2),
      ]),
    ];

    const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `RV-SpendWise-Analytics-${todayString}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  /* PDF EXPORT */

  function exportPDF() {
    window.print();
  }

  /* LOADING */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 bg-[#0c0d14] text-gray-400">
        <Loader2 className="animate-spin" size={22} />
        Loading RV SpendWise Analytics...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0c0d14] p-5 text-white md:p-8">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }

          body * {
            visibility: hidden !important;
          }

          #analytics-report,
          #analytics-report * {
            visibility: visible !important;
          }

          #analytics-report {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            padding: 20px !important;
            background: white !important;
            color: black !important;
          }

          #analytics-report .print-card {
            background: white !important;
            color: black !important;
            border: 1px solid #ddd !important;
            break-inside: avoid;
          }

          #analytics-report .print-muted {
            color: #555 !important;
          }

          #analytics-report .no-print {
            display: none !important;
          }

          #analytics-report svg text {
            fill: #333 !important;
          }

          #analytics-report .recharts-cartesian-grid line {
            stroke: #ddd !important;
          }

          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>

      <div id="analytics-report">
        {/* HEADER */}

        <header className="no-print mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-white/10 p-3 hover:bg-white/10"
            >
              <ArrowLeft size={20} />
            </button>

            <div>
              <h1 className="text-2xl font-bold">Financial Analytics</h1>
              <p className="text-sm text-gray-400">
                Understand your money with real-time insights
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadAnalytics()}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm hover:bg-white/10"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm hover:bg-white/10"
            >
              <Download size={16} />
              Export CSV
            </button>

            <button
              onClick={exportPDF}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold hover:bg-violet-500"
            >
              <FileText size={16} />
              Export PDF
            </button>
          </div>
        </header>

        {error && (
          <div className="no-print mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* REPORT TITLE */}

        <div className="mb-6">
          <h2 className="text-xl font-bold">RV SpendWise Financial Report</h2>
          <p className="print-muted mt-1 text-sm text-gray-400">
            Generated on {todayString}
          </p>
        </div>

        {/* PERIOD SELECTOR */}

        <section className="no-print mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#151722] p-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="text-violet-400" />
            <div>
              <p className="font-semibold">Analytics Period</p>
              <p className="text-xs text-gray-500">
                Select the time range for your overview and trends
              </p>
            </div>
          </div>

          <div className="flex rounded-xl bg-[#0c0d14] p-1">
            {(["daily", "monthly", "yearly"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={`rounded-lg px-4 py-2 text-sm capitalize ${
                  period === item
                    ? "bg-violet-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        {/* FINANCIAL OVERVIEW */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Total Income"
            value={formatMoney(totalIncome)}
            subtitle="Selected period"
            icon={<TrendingUp size={21} />}
            color="text-green-400"
          />

          <SummaryCard
            title="Total Expenses"
            value={formatMoney(totalExpenses)}
            subtitle="Selected period"
            icon={<TrendingDown size={21} />}
            color="text-red-400"
          />

          <SummaryCard
            title="Net Savings"
            value={formatMoney(netSavings)}
            subtitle="Income minus expenses"
            icon={<PiggyBank size={21} />}
            color={netSavings >= 0 ? "text-violet-400" : "text-red-400"}
          />

          <SummaryCard
            title="Savings Rate"
            value={`${savingsRate.toFixed(1)}%`}
            subtitle="Net savings / income"
            icon={<Wallet size={21} />}
            color="text-blue-400"
          />
        </section>

        {/* INCOME VS EXPENSES */}

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6 print-card">
          <div className="mb-5">
            <h2 className="text-lg font-bold">Income VS Expenses</h2>
            <p className="print-muted mt-1 text-sm text-gray-400">
              Monthly comparison over the last six months
            </p>
          </div>

          {monthlyComparison.every(
            (item) => item.income === 0 && item.expenses === 0,
          ) ? (
            <EmptyChart message="No income or expense records found for this period." />
          ) : (
            <div className="h-[310px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyComparison}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#30313d" />
                  <XAxis
                    dataKey="month"
                    stroke="#9293a0"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#9293a0"
                    tickFormatter={formatCompactMoney}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={{
                      background: "#202130",
                      border: "1px solid #39394b",
                      borderRadius: 12,
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="#10B981"
                    radius={[5, 5, 0, 0]}
                  />
                  <Bar
                    dataKey="expenses"
                    name="Expenses"
                    fill="#EF4444"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* CATEGORY BREAKDOWN */}

        <section className="mb-8 grid gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6 print-card">
            <h2 className="text-lg font-bold">Expense by Category</h2>
            <p className="print-muted mt-1 text-sm text-gray-400">
              Where your money goes
            </p>

            {categoryData.length === 0 ? (
              <EmptyChart message="No expense categories available yet." />
            ) : (
              <>
                <div className="h-[270px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={3}
                      >
                        {categoryData.map((item, index) => (
                          <Cell
                            key={item.name}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value) => formatMoney(Number(value))}
                        contentStyle={{
                          background: "#202130",
                          border: "1px solid #39394b",
                          borderRadius: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {categoryData.map((item, index) => {
                    const percentage =
                      totalExpenses > 0
                        ? (item.value / totalExpenses) * 100
                        : 0;

                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          />
                          <span className="truncate text-gray-300">
                            {item.name}
                          </span>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="font-medium">
                            {formatMoney(item.value)}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* SAVINGS ANALYSIS */}

          <div className="rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6 print-card">
            <h2 className="text-lg font-bold">Savings Analysis</h2>
            <p className="print-muted mt-1 text-sm text-gray-400">
              Monthly income minus expenses over six months
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs text-gray-400">Net savings</p>
                <p
                  className={`mt-2 text-xl font-bold ${
                    netSavings >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatMoney(netSavings)}
                </p>
              </div>

              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-xs text-gray-400">Average daily expense</p>
                <p className="mt-2 text-xl font-bold text-white">
                  {formatMoney(averageDailyExpense)}
                </p>
              </div>
            </div>

            <div className="mt-5 h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={savingsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30313d" />
                  <XAxis
                    dataKey="month"
                    stroke="#9293a0"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#9293a0"
                    tickFormatter={formatCompactMoney}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={{
                      background: "#202130",
                      border: "1px solid #39394b",
                      borderRadius: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    name="Net savings"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="print-muted mt-2 text-xs text-gray-500">
              A negative value means recorded expenses exceeded recorded income
              for that month.
            </p>
          </div>
        </section>

        {/* DAILY / MONTHLY / YEARLY TREND */}

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6 print-card">
          <div className="mb-5">
            <h2 className="text-lg font-bold">Spending Trends</h2>
            <p className="print-muted mt-1 text-sm text-gray-400">
              {period === "daily"
                ? "Daily income, expenses and savings for the last 30 days"
                : period === "monthly"
                  ? "Monthly income, expenses and savings for the last 12 months"
                  : "Yearly income, expenses and savings for the last five years"}
            </p>
          </div>

          <div className="no-print mb-4 flex gap-2">
            {(["daily", "monthly", "yearly"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={`rounded-lg px-3 py-2 text-xs capitalize ${
                  period === item
                    ? "bg-violet-600 text-white"
                    : "bg-white/5 text-gray-400"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="h-[330px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#30313d" />
                <XAxis
                  dataKey="label"
                  stroke="#9293a0"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#9293a0"
                  tickFormatter={formatCompactMoney}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  contentStyle={{
                    background: "#202130",
                    border: "1px solid #39394b",
                    borderRadius: 12,
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="savings"
                  name="Net savings"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* BUDGET PERFORMANCE */}

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6 print-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Budget Performance</h2>
              <p className="print-muted mt-1 text-sm text-gray-400">
                Current month category budget tracking
              </p>
            </div>

            <button
              onClick={() => router.push("/budgets")}
              className="no-print rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
            >
              Manage Budgets
            </button>
          </div>

          {currentMonthBudgets.length === 0 ? (
            <div className="rounded-xl bg-white/5 p-6 text-center">
              <Wallet size={30} className="mx-auto mb-3 text-violet-400" />
              <p className="font-medium">
                No budgets configured for this month
              </p>
              <p className="print-muted mt-1 text-sm text-gray-400">
                Create category budgets to see performance here.
              </p>
              <button
                onClick={() => router.push("/budgets")}
                className="no-print mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm"
              >
                Create Budget
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
                <MiniStat
                  title="Budget available"
                  value={formatMoney(currentMonthBudgetTotal)}
                />
                <MiniStat
                  title="Spent this month"
                  value={formatMoney(currentMonthSpent)}
                />
                <MiniStat
                  title="Remaining"
                  value={formatMoney(currentMonthRemaining)}
                />
              </div>

              <div className="space-y-5">
                {budgetPerformance.map((item) => {
                  const over = item.spent > item.available;

                  return (
                    <div key={item.category}>
                      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                        <span className="font-medium">{item.category}</span>

                        <span className="text-gray-400">
                          {formatMoney(item.spent)} /{" "}
                          {formatMoney(item.available)}
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full rounded-full ${
                            over
                              ? "bg-red-500"
                              : item.percentage >= 80
                                ? "bg-yellow-500"
                                : "bg-violet-500"
                          }`}
                          style={{
                            width: `${Math.min(item.percentage, 100)}%`,
                          }}
                        />
                      </div>

                      <p
                        className={`mt-1 text-xs ${
                          over ? "text-red-400" : "text-gray-500"
                        }`}
                      >
                        {over
                          ? `${formatMoney(Math.abs(item.remaining))} over budget`
                          : `${formatMoney(item.remaining)} remaining`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* SMART INSIGHTS */}

        <section className="mb-8 rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6 print-card">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-yellow-500/10 p-3 text-yellow-400">
              <Lightbulb size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold">Smart Financial Insights</h2>
              <p className="print-muted text-sm text-gray-400">
                Observations calculated from your transaction history
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((item, index) => (
              <InsightCard
                key={`${item.title}-${index}`}
                title={item.title}
                description={item.description}
                type={item.type}
              />
            ))}
          </div>
        </section>

        {/* FOOTER */}

        <footer className="print-muted border-t border-white/10 py-5 text-center text-xs text-gray-500">
          RV SpendWise · Financial Analytics · Data based on recorded
          transactions
        </footer>
      </div>
    </main>
  );
}

/* REUSABLE COMPONENTS */

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="print-card rounded-2xl border border-white/10 bg-[#151722] p-5">
      <div className={`mb-4 flex items-center justify-between ${color}`}>
        <span className="text-sm text-gray-400">{title}</span>
        {icon}
      </div>

      <h2 className="text-2xl font-bold">{value}</h2>

      <p className="print-muted mt-2 text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-4">
      <p className="text-xs text-gray-400">{title}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}

function InsightCard({
  title,
  description,
  type,
}: {
  title: string;
  description: string;
  type: "success" | "warning" | "info";
}) {
  const icon =
    type === "success" ? (
      <CheckCircle2 size={19} />
    ) : type === "warning" ? (
      <AlertTriangle size={19} />
    ) : (
      <Lightbulb size={19} />
    );

  const color =
    type === "success"
      ? "text-green-400 bg-green-500/10"
      : type === "warning"
        ? "text-yellow-400 bg-yellow-500/10"
        : "text-violet-400 bg-violet-500/10";

  return (
    <div className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-4">
      <div className={`h-fit rounded-lg p-2 ${color}`}>{icon}</div>

      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="print-muted mt-1 text-xs leading-5 text-gray-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center text-center text-sm text-gray-500">
      {message}
    </div>
  );
}
