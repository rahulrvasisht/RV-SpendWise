"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Target,
  Wallet,
  TrendingUp,
  PiggyBank,
  Plus,
  Pencil,
  Trash2,
  X,
  CalendarDays,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Repeat,
  Pause,
  Play,
  IndianRupee,
  History,
  Calculator,
  Trophy,
  Sparkles,
  Loader2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Goal = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_amount: number;
  target_date: string | null;
  priority: "low" | "medium" | "high";
  icon: string;
  status: "active" | "paused" | "completed";
  created_at: string;
};

type Contribution = {
  id: string;
  user_id: string;
  goal_id: string;
  amount: number;
  contribution_date: string;
  note: string | null;
  created_at: string;
};

type RecurringPlan = {
  id: string;
  user_id: string;
  goal_id: string;
  amount: number;
  frequency: "weekly" | "monthly";
  next_due_date: string;
  reminder_enabled: boolean;
  is_active: boolean;
};

type GoalForm = {
  name: string;
  description: string;
  target_amount: string;
  target_date: string;
  priority: "low" | "medium" | "high";
  icon: string;
};

const supabase = createClient();

const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const dateFormat = (value: string | null) => {
  if (!value) return "No deadline";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const todayString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const initialGoalForm: GoalForm = {
  name: "",
  description: "",
  target_amount: "",
  target_date: "",
  priority: "medium",
  icon: "target",
};

export default function SavingsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [recurringPlans, setRecurringPlans] = useState<RecurringPlan[]>([]);

  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [goalModal, setGoalModal] = useState(false);
  const [contributionModal, setContributionModal] = useState(false);
  const [recurringModal, setRecurringModal] = useState(false);

  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [selectedGoal, setSelectedGoal] = useState("");

  const [goalForm, setGoalForm] = useState<GoalForm>(initialGoalForm);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionNote, setContributionNote] = useState("");
  const [contributionDate, setContributionDate] = useState(todayString());

  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringFrequency, setRecurringFrequency] = useState<
    "weekly" | "monthly"
  >("monthly");
  const [recurringDate, setRecurringDate] = useState(todayString());

  const [calculatorGoal, setCalculatorGoal] = useState("");
  const [calculatorAmount, setCalculatorAmount] = useState("");

  const notify = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setSuccess("");
    } else {
      setSuccess(message);
      setError("");
    }

    window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setUserId("");
        setGoals([]);
        setContributions([]);
        setRecurringPlans([]);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const [goalResult, contributionResult, recurringResult] =
        await Promise.all([
          supabase
            .from("savings_goals")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("savings_contributions")
            .select("*")
            .eq("user_id", user.id)
            .order("contribution_date", { ascending: false }),

          supabase
            .from("savings_recurring")
            .select("*")
            .eq("user_id", user.id)
            .order("next_due_date", { ascending: true }),
        ]);

      if (goalResult.error) throw goalResult.error;
      if (contributionResult.error) throw contributionResult.error;
      if (recurringResult.error) throw recurringResult.error;

      setGoals((goalResult.data || []) as Goal[]);
      setContributions((contributionResult.data || []) as Contribution[]);
      setRecurringPlans((recurringResult.data || []) as RecurringPlan[]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your savings data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const savedByGoal = useMemo(() => {
    const result: Record<string, number> = {};

    contributions.forEach((item) => {
      result[item.goal_id] = (result[item.goal_id] || 0) + Number(item.amount);
    });

    return result;
  }, [contributions]);

  const activeGoals = goals.filter((goal) => goal.status === "active");
  const pausedGoals = goals.filter((goal) => goal.status === "paused");

  const totalTarget = goals.reduce(
    (sum, goal) => sum + Number(goal.target_amount),
    0,
  );

  const totalSaved = Object.values(savedByGoal).reduce(
    (sum, amount) => sum + amount,
    0,
  );

  const totalRemaining = Math.max(totalTarget - totalSaved, 0);

  const overallProgress =
    totalTarget > 0 ? Math.min((totalSaved / totalTarget) * 100, 100) : 0;

  const completedGoals = goals.filter(
    (goal) => (savedByGoal[goal.id] || 0) >= Number(goal.target_amount),
  ).length;

  const getProgress = (goal: Goal) => {
    const saved = savedByGoal[goal.id] || 0;
    return Math.min((saved / Number(goal.target_amount)) * 100, 100);
  };

  const getRemaining = (goal: Goal) =>
    Math.max(Number(goal.target_amount) - (savedByGoal[goal.id] || 0), 0);

  const getGoalName = (goalId: string) =>
    goals.find((goal) => goal.id === goalId)?.name || "Deleted goal";

  const openCreateGoal = () => {
    setEditingGoal(null);
    setGoalForm(initialGoalForm);
    setGoalModal(true);
  };

  const openEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      description: goal.description || "",
      target_amount: String(goal.target_amount),
      target_date: goal.target_date || "",
      priority: goal.priority,
      icon: goal.icon || "target",
    });
    setGoalModal(true);
  };

  const saveGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId) {
      notify("Please sign in to create a savings goal.", true);
      return;
    }

    const amount = Number(goalForm.target_amount);

    if (!goalForm.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify("Enter a goal name and a valid target amount.", true);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: goalForm.name.trim(),
        description: goalForm.description.trim() || null,
        target_amount: amount,
        target_date: goalForm.target_date || null,
        priority: goalForm.priority,
        icon: goalForm.icon,
        updated_at: new Date().toISOString(),
      };

      if (editingGoal) {
        const { error: updateError } = await supabase
          .from("savings_goals")
          .update(payload)
          .eq("id", editingGoal.id)
          .eq("user_id", userId);

        if (updateError) throw updateError;
        notify("Savings goal updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("savings_goals")
          .insert({
            ...payload,
            user_id: userId,
          });

        if (insertError) throw insertError;
        notify("Your new savings goal has been created.");
      }

      setGoalModal(false);
      setEditingGoal(null);
      setGoalForm(initialGoalForm);
      await loadData();
    } catch (err) {
      console.error(err);
      notify(err instanceof Error ? err.message : "Unable to save goal.", true);
    } finally {
      setSaving(false);
    }
  };

  const deleteGoal = async (goal: Goal) => {
    const confirmed = window.confirm(
      `Delete "${goal.name}" and its contribution history? This cannot be undone.`,
    );

    if (!confirmed || !userId) return;

    try {
      const { error: deleteError } = await supabase
        .from("savings_goals")
        .delete()
        .eq("id", goal.id)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      notify("Savings goal deleted.");
      await loadData();
    } catch (err) {
      console.error(err);
      notify(
        err instanceof Error ? err.message : "Unable to delete goal.",
        true,
      );
    }
  };

  const openAddContribution = (goalId: string) => {
    setSelectedGoal(goalId);
    setContributionAmount("");
    setContributionNote("");
    setContributionDate(todayString());
    setContributionModal(true);
  };

  const addContribution = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(contributionAmount);

    if (!userId || !selectedGoal || !Number.isFinite(amount) || amount <= 0) {
      notify("Enter a valid contribution amount.", true);
      return;
    }

    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from("savings_contributions")
        .insert({
          user_id: userId,
          goal_id: selectedGoal,
          amount,
          contribution_date: contributionDate,
          note: contributionNote.trim() || null,
        });

      if (insertError) throw insertError;

      setContributionModal(false);
      notify("Money added to your savings goal!");
      await loadData();
    } catch (err) {
      console.error(err);
      notify(
        err instanceof Error ? err.message : "Unable to add contribution.",
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteContribution = async (item: Contribution) => {
    if (
      !window.confirm(
        `Delete this ${currency(Number(item.amount))} contribution?`,
      )
    ) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("savings_contributions")
        .delete()
        .eq("id", item.id)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      notify("Contribution removed.");
      await loadData();
    } catch (err) {
      console.error(err);
      notify(
        err instanceof Error ? err.message : "Unable to delete contribution.",
        true,
      );
    }
  };

  const addRecurringPlan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const amount = Number(recurringAmount);

    if (!userId || !selectedGoal || !Number.isFinite(amount) || amount <= 0) {
      notify("Enter a valid recurring amount.", true);
      return;
    }

    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from("savings_recurring")
        .insert({
          user_id: userId,
          goal_id: selectedGoal,
          amount,
          frequency: recurringFrequency,
          next_due_date: recurringDate,
          reminder_enabled: true,
          is_active: true,
        });

      if (insertError) throw insertError;

      setRecurringModal(false);
      setRecurringAmount("");
      notify("Recurring savings plan created.");
      await loadData();
    } catch (err) {
      console.error(err);
      notify(
        err instanceof Error ? err.message : "Unable to create recurring plan.",
        true,
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleRecurring = async (plan: RecurringPlan) => {
    try {
      const { error: updateError } = await supabase
        .from("savings_recurring")
        .update({
          is_active: !plan.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plan.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;

      notify(
        plan.is_active ? "Recurring plan paused." : "Recurring plan resumed.",
      );
      await loadData();
    } catch (err) {
      console.error(err);
      notify("Unable to update recurring plan.", true);
    }
  };

  const deleteRecurring = async (plan: RecurringPlan) => {
    if (!window.confirm("Delete this recurring savings plan?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("savings_recurring")
        .delete()
        .eq("id", plan.id)
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      notify("Recurring plan deleted.");
      await loadData();
    } catch (err) {
      console.error(err);
      notify("Unable to delete recurring plan.", true);
    }
  };

  const recordRecurringContribution = async (plan: RecurringPlan) => {
    if (!userId) return;

    const confirmed = window.confirm(
      `Record ${currency(Number(plan.amount))} towards "${getGoalName(
        plan.goal_id,
      )}"?`,
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from("savings_contributions")
        .insert({
          user_id: userId,
          goal_id: plan.goal_id,
          amount: Number(plan.amount),
          contribution_date: todayString(),
          note: `Recurring ${plan.frequency} contribution`,
        });

      if (insertError) throw insertError;

      const nextDate = new Date(`${plan.next_due_date}T00:00:00`);

      if (plan.frequency === "weekly") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }

      const nextDue = [
        nextDate.getFullYear(),
        String(nextDate.getMonth() + 1).padStart(2, "0"),
        String(nextDate.getDate()).padStart(2, "0"),
      ].join("-");

      const { error: updateError } = await supabase
        .from("savings_recurring")
        .update({
          next_due_date: nextDue,
          updated_at: new Date().toISOString(),
        })
        .eq("id", plan.id)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(
          "Contribution was recorded, but the next reminder date could not be updated. Please refresh and check the plan.",
        );
      }

      notify("Recurring contribution recorded!");
      await loadData();
    } catch (err) {
      console.error(err);
      notify(
        err instanceof Error
          ? err.message
          : "Unable to record recurring contribution.",
        true,
      );
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const exportCSV = () => {
    const quote = (value: string | number) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows: (string | number)[][] = [
      ["RV SpendWise - Savings Goals Report"],
      ["Generated", new Date().toLocaleString("en-IN")],
      [],
      [
        "Goal",
        "Target Amount",
        "Saved Amount",
        "Remaining",
        "Progress",
        "Target Date",
        "Priority",
        "Status",
      ],
      ...goals.map((goal) => [
        goal.name,
        Number(goal.target_amount),
        savedByGoal[goal.id] || 0,
        getRemaining(goal),
        `${getProgress(goal).toFixed(1)}%`,
        goal.target_date || "",
        goal.priority,
        goal.status,
      ]),
      [],
      ["Contribution History"],
      ["Goal", "Amount", "Date", "Note"],
      ...contributions.map((item) => [
        getGoalName(item.goal_id),
        Number(item.amount),
        item.contribution_date,
        item.note || "",
      ]),
    ];

    const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "RV-SpendWise-Savings-Report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      let y = 20;

      doc.setFontSize(20);
      doc.text("RV SpendWise", 14, y);

      y += 9;
      doc.setFontSize(14);
      doc.text("Savings Goals Report", 14, y);

      y += 9;
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, y);

      y += 12;
      doc.setFontSize(11);
      doc.text(`Total target: ${currency(totalTarget)}`, 14, y);
      y += 7;
      doc.text(`Total saved: ${currency(totalSaved)}`, 14, y);
      y += 7;
      doc.text(`Remaining: ${currency(totalRemaining)}`, 14, y);
      y += 7;
      doc.text(`Overall progress: ${overallProgress.toFixed(1)}%`, 14, y);

      y += 14;
      doc.setFontSize(13);
      doc.text("Savings Goals", 14, y);
      y += 8;

      goals.forEach((goal) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(10);
        doc.text(goal.name, 14, y);
        y += 6;
        doc.text(
          `Target: ${currency(Number(goal.target_amount))} | Saved: ${currency(
            savedByGoal[goal.id] || 0,
          )}`,
          18,
          y,
        );
        y += 6;
        doc.text(
          `Remaining: ${currency(getRemaining(goal))} | Progress: ${getProgress(
            goal,
          ).toFixed(1)}%`,
          18,
          y,
        );
        y += 9;
      });

      y += 4;

      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(13);
      doc.text("Contribution History", 14, y);
      y += 9;

      contributions.forEach((item) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(9);
        doc.text(
          `${dateFormat(item.contribution_date)} | ${getGoalName(
            item.goal_id,
          )} | ${currency(Number(item.amount))}`,
          14,
          y,
        );
        y += 7;
      });

      doc.save("RV-SpendWise-Savings-Report.pdf");
    } catch (err) {
      console.error(err);
      notify("Unable to generate PDF report.", true);
    }
  };

  const insights = useMemo(() => {
    const items: { title: string; description: string }[] = [];

    if (goals.length === 0) {
      items.push({
        title: "Start your savings journey",
        description:
          "Create your first savings goal and give your money a clear purpose.",
      });
      return items;
    }

    if (completedGoals > 0) {
      items.push({
        title: "Goal achievement",
        description: `You've completed ${completedGoals} savings goal${
          completedGoals === 1 ? "" : "s"
        }. Keep building that momentum!`,
      });
    }

    const bestGoal = [...goals].sort(
      (a, b) => getProgress(b) - getProgress(a),
    )[0];

    if (bestGoal) {
      items.push({
        title: "Closest to completion",
        description: `${bestGoal.name} is ${getProgress(bestGoal).toFixed(
          0,
        )}% complete. You need ${currency(
          getRemaining(bestGoal),
        )} more to reach your target.`,
      });
    }

    const duePlans = recurringPlans.filter(
      (plan) =>
        plan.is_active &&
        plan.reminder_enabled &&
        plan.next_due_date <= todayString(),
    );

    if (duePlans.length > 0) {
      items.push({
        title: "Recurring contribution due",
        description: `${duePlans.length} recurring savings plan${
          duePlans.length === 1 ? " is" : "s are"
        } due. Review and confirm your contribution.`,
      });
    }

    const goalsWithDeadline = activeGoals.filter(
      (goal) => goal.target_date && getRemaining(goal) > 0,
    );

    if (goalsWithDeadline.length > 0) {
      const goal = goalsWithDeadline[0];
      const daysLeft = Math.max(
        1,
        Math.ceil(
          (new Date(`${goal.target_date}T00:00:00`).getTime() -
            new Date(`${todayString()}T00:00:00`).getTime()) /
            86400000,
        ),
      );

      if (daysLeft > 0) {
        const monthlyNeeded = getRemaining(goal) / (daysLeft / 30.44);

        items.push({
          title: "Savings pace",
          description: `To reach "${goal.name}" by its target date, aim to save approximately ${currency(
            monthlyNeeded,
          )} per month.`,
        });
      } else {
        items.push({
          title: "Review your target date",
          description: `"${goal.name}" has reached its target date. Consider updating the deadline or contribution plan.`,
        });
      }
    }

    if (totalSaved === 0 && goals.length > 0) {
      items.push({
        title: "Make your first contribution",
        description:
          "Add even a small amount to start building progress towards your goals.",
      });
    }

    if (items.length < 3) {
      items.push({
        title: "Keep your savings consistent",
        description:
          "Regular contributions can help you reach your goals without needing large one-time deposits.",
      });
    }

    return items.slice(0, 4);
  }, [
    goals,
    recurringPlans,
    contributions,
    totalSaved,
    completedGoals,
    activeGoals,
    savedByGoal,
  ]);

  const calculatorResult = useMemo(() => {
    const goal = goals.find((item) => item.id === calculatorGoal);

    if (!goal || !goal.target_date) return null;

    const remaining = getRemaining(goal);
    const days = Math.max(
      1,
      Math.ceil(
        (new Date(`${goal.target_date}T00:00:00`).getTime() -
          new Date(`${todayString()}T00:00:00`).getTime()) /
          86400000,
      ),
    );

    const months = Math.max(days / 30.44, 1 / 30.44);
    const suggestedMonthly = remaining / months;
    const enteredMonthly = Number(calculatorAmount) || 0;

    return {
      remaining,
      suggestedMonthly,
      enteredMonthly,
      canReach: enteredMonthly > 0 && enteredMonthly * months >= remaining,
      days,
    };
  }, [calculatorGoal, calculatorAmount, goals, contributions]);

  const milestoneList = [25, 50, 75, 100];

  const duePlans = recurringPlans.filter(
    (plan) => plan.is_active && plan.next_due_date <= todayString(),
  );

  const completedContributionCount = contributions.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0d14] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-violet-300">
          <Loader2 className="animate-spin" size={22} />
          Loading RV SpendWise Savings...
        </div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-[#0c0d14] text-white p-6 flex items-center justify-center">
        <div className="max-w-md text-center rounded-2xl border border-white/10 bg-[#151722] p-8">
          <Wallet size={42} className="mx-auto mb-4 text-violet-400" />
          <h1 className="text-2xl font-bold">Sign in to view Savings</h1>
          <p className="mt-3 text-sm text-gray-400">
            Please sign in to manage your RV SpendWise savings goals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0c0d14] text-white p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-7">
        {/* HEADER */}

        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-violet-400">
              <PiggyBank size={17} />
              RV SpendWise
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Savings Goals</h1>

            <p className="mt-2 text-sm text-gray-400">
              Plan your future, track your progress and grow your savings.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#171a26] px-4 py-2.5 text-sm text-gray-200 transition hover:bg-[#222638]"
            >
              <FileSpreadsheet size={17} />
              Export CSV
            </button>

            <button
              onClick={exportPDF}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#171a26] px-4 py-2.5 text-sm text-gray-200 transition hover:bg-[#222638]"
            >
              <FileText size={17} />
              Export PDF
            </button>

            <button
              onClick={openCreateGoal}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold transition hover:bg-violet-500"
            >
              <Plus size={18} />
              New Goal
            </button>
          </div>
        </header>

        {/* NOTIFICATIONS */}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}

        {/* OVERVIEW CARDS */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            title="Total savings target"
            amount={currency(totalTarget)}
            icon={<Target size={21} />}
            detail={`${goals.length} total goals`}
            color="violet"
          />

          <OverviewCard
            title="Total amount saved"
            amount={currency(totalSaved)}
            icon={<Wallet size={21} />}
            detail={`${completedContributionCount} contributions`}
            color="emerald"
          />

          <OverviewCard
            title="Remaining amount"
            amount={currency(totalRemaining)}
            icon={<TrendingUp size={21} />}
            detail="Across all your goals"
            color="blue"
          />

          <OverviewCard
            title="Goals completed"
            amount={`${completedGoals} / ${goals.length}`}
            icon={<Trophy size={21} />}
            detail={`${overallProgress.toFixed(1)}% overall progress`}
            color="amber"
          />
        </section>

        {/* OVERALL PROGRESS */}

        <section className="rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Overall savings progress
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Your combined progress across all goals
              </p>
            </div>

            <span className="text-2xl font-bold text-violet-300">
              {overallProgress.toFixed(1)}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-[#272a39]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 to-indigo-400 transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          <div className="mt-3 flex justify-between text-xs text-gray-400">
            <span>{currency(totalSaved)} saved</span>
            <span>{currency(totalTarget)} target</span>
          </div>
        </section>

        {/* DUE REMINDERS */}

        {duePlans.length > 0 && (
          <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="mb-3 flex items-center gap-2 text-amber-300">
              <Clock size={19} />
              <h2 className="font-semibold">Savings reminders due</h2>
            </div>

            <p className="mb-4 text-sm text-gray-400">
              You have {duePlans.length} recurring contribution
              {duePlans.length === 1 ? "" : "s"} waiting for confirmation.
            </p>

            <div className="space-y-3">
              {duePlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-[#151722] p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium">{getGoalName(plan.goal_id)}</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {currency(Number(plan.amount))} · {plan.frequency} · Due{" "}
                      {dateFormat(plan.next_due_date)}
                    </p>
                  </div>

                  <button
                    onClick={() => recordRecurringContribution(plan)}
                    disabled={saving}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50"
                  >
                    Confirm contribution
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* GOALS */}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Your savings goals</h2>
              <p className="mt-1 text-sm text-gray-400">
                Track each goal individually
              </p>
            </div>

            <button
              onClick={openCreateGoal}
              className="flex items-center gap-2 rounded-lg border border-violet-500/30 px-3 py-2 text-sm text-violet-300 hover:bg-violet-500/10"
            >
              <Plus size={16} />
              Add goal
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#151722] p-10 text-center">
              <Target size={40} className="mx-auto mb-4 text-violet-400" />
              <h3 className="text-lg font-semibold">
                Your savings journey starts here
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
                Create your first goal, such as an emergency fund, a new laptop,
                a vacation or your dream home.
              </p>
              <button
                onClick={openCreateGoal}
                className="mt-5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold hover:bg-violet-500"
              >
                Create your first goal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {goals.map((goal) => {
                const saved = savedByGoal[goal.id] || 0;
                const progress = getProgress(goal);
                const remaining = getRemaining(goal);
                const isComplete = progress >= 100;

                return (
                  <article
                    key={goal.id}
                    className="rounded-2xl border border-white/10 bg-[#151722] p-5 transition hover:border-violet-500/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                          <Target size={23} />
                        </div>

                        <div>
                          <h3 className="font-semibold">{goal.name}</h3>
                          <p className="mt-1 text-xs text-gray-400">
                            {goal.description || "Savings goal"}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditGoal(goal)}
                          title="Edit goal"
                          className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => deleteGoal(goal)}
                          title="Delete goal"
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Amount saved</p>
                        <p className="mt-1 text-2xl font-bold">
                          {currency(saved)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-400">Target</p>
                        <p className="mt-1 font-semibold">
                          {currency(Number(goal.target_amount))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#292c3b]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isComplete
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-violet-600 to-indigo-400"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="mt-2 flex justify-between text-xs">
                      <span className="text-violet-300">
                        {progress.toFixed(1)}% complete
                      </span>
                      <span className="text-gray-400">
                        {currency(remaining)} left
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-white/5 px-3 py-1.5 text-gray-300">
                        {goal.priority.toUpperCase()} priority
                      </span>

                      <span className="rounded-full bg-white/5 px-3 py-1.5 text-gray-300">
                        {goal.status}
                      </span>

                      <span className="flex items-center gap-1 rounded-full bg-white/5 px-3 py-1.5 text-gray-400">
                        <CalendarDays size={13} />
                        {dateFormat(goal.target_date)}
                      </span>
                    </div>

                    {/* MILESTONES */}

                    <div className="mt-5">
                      <p className="mb-3 text-xs font-medium text-gray-400">
                        Milestones
                      </p>

                      <div className="grid grid-cols-4 gap-2">
                        {milestoneList.map((milestone) => {
                          const reached = progress >= milestone;

                          return (
                            <div
                              key={milestone}
                              className={`rounded-lg px-2 py-2 text-center text-xs ${
                                reached
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-white/5 text-gray-500"
                              }`}
                            >
                              {reached ? (
                                <CheckCircle2
                                  size={14}
                                  className="mx-auto mb-1"
                                />
                              ) : (
                                <Target size={14} className="mx-auto mb-1" />
                              )}
                              {milestone}%
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {isComplete && (
                      <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
                        <Trophy size={17} />
                        Congratulations! You've reached this goal.
                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openAddContribution(goal.id)}
                        disabled={goal.status !== "active" || isComplete}
                        className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus size={16} />
                        Add money
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGoal(goal.id);
                          setRecurringAmount("");
                          setRecurringFrequency("monthly");
                          setRecurringDate(todayString());
                          setRecurringModal(true);
                        }}
                        disabled={goal.status !== "active" || isComplete}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Repeat size={16} />
                        Recurring
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {pausedGoals.length > 0 && (
            <div className="mt-5 rounded-xl border border-white/10 bg-[#151722] p-4">
              <p className="text-sm font-semibold text-gray-300">
                Paused goals
              </p>
              <p className="mt-1 text-xs text-gray-500">
                These goals are retained, but their progress is not lost.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pausedGoals.map((goal) => (
                  <span
                    key={goal.id}
                    className="rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-300"
                  >
                    {goal.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* CALCULATOR */}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/15 p-3 text-blue-300">
                <Calculator size={22} />
              </div>
              <div>
                <h2 className="font-semibold">Monthly savings calculator</h2>
                <p className="text-xs text-gray-400">
                  Calculate how much you need to save each month.
                </p>
              </div>
            </div>

            <label className="mb-2 block text-sm text-gray-300">
              Select a savings goal
            </label>

            <select
              value={calculatorGoal}
              onChange={(e) => setCalculatorGoal(e.target.value)}
              className="mb-4 w-full rounded-xl border border-white/10 bg-[#0f111b] p-3 text-sm text-white outline-none focus:border-violet-500"
            >
              <option value="">Choose a goal</option>
              {goals
                .filter((goal) => goal.target_date)
                .map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.name}
                  </option>
                ))}
            </select>

            <label className="mb-2 block text-sm text-gray-300">
              How much can you save monthly? (Optional)
            </label>

            <input
              type="number"
              min="0"
              value={calculatorAmount}
              onChange={(e) => setCalculatorAmount(e.target.value)}
              placeholder="Enter monthly savings amount"
              className="w-full rounded-xl border border-white/10 bg-[#0f111b] p-3 text-sm text-white outline-none focus:border-violet-500"
            />

            {calculatorResult ? (
              <div className="mt-5 space-y-3 rounded-xl bg-violet-500/10 p-4">
                <p className="text-sm text-gray-300">Amount still needed</p>
                <p className="text-2xl font-bold text-white">
                  {currency(calculatorResult.remaining)}
                </p>

                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-400">
                    Suggested monthly savings
                  </span>
                  <span className="font-semibold text-violet-300">
                    {currency(calculatorResult.suggestedMonthly)}
                  </span>
                </div>

                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-400">Days remaining</span>
                  <span className="text-gray-200">{calculatorResult.days}</span>
                </div>

                {calculatorResult.enteredMonthly > 0 && (
                  <div
                    className={`rounded-lg p-3 text-sm ${
                      calculatorResult.canReach
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {calculatorResult.canReach
                      ? "Your planned monthly savings should reach this goal by its target date."
                      : "Your current monthly savings plan may not reach the target date. Consider increasing the monthly amount or adjusting the deadline."}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs text-gray-500">
                Choose a goal with a target date to see the monthly savings
                calculation.
              </p>
            )}
          </div>

          {/* SMART INSIGHTS */}

          <div className="rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/15 p-3 text-amber-300">
                <Sparkles size={22} />
              </div>
              <div>
                <h2 className="font-semibold">Smart savings insights</h2>
                <p className="text-xs text-gray-400">
                  Suggestions based on your savings activity.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div
                  key={`${insight.title}-${index}`}
                  className="flex gap-3 rounded-xl border border-white/5 bg-[#10121c] p-4"
                >
                  <div className="mt-0.5 text-amber-300">
                    <Lightbulb size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-400">
                      {insight.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RECURRING PLANS */}

        <section className="rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-indigo-500/15 p-3 text-indigo-300">
              <Repeat size={21} />
            </div>
            <div>
              <h2 className="font-semibold">Recurring savings plans</h2>
              <p className="text-xs text-gray-400">
                Manage weekly and monthly contribution reminders.
              </p>
            </div>
          </div>

          {recurringPlans.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <Clock size={27} className="mx-auto mb-3 text-gray-500" />
              <p className="text-sm text-gray-300">No recurring plans yet.</p>
              <p className="mt-1 text-xs text-gray-500">
                Create a recurring plan from one of your active goals.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recurringPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-white/5 bg-[#10121c] p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{getGoalName(plan.goal_id)}</p>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] ${
                          plan.is_active
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-gray-500/10 text-gray-400"
                        }`}
                      >
                        {plan.is_active ? "ACTIVE" : "PAUSED"}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-gray-400">
                      {currency(Number(plan.amount))} / {plan.frequency}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Next due: {dateFormat(plan.next_due_date)}
                      {plan.reminder_enabled ? " · Reminder enabled" : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {plan.is_active && (
                      <button
                        onClick={() => recordRecurringContribution(plan)}
                        disabled={saving}
                        className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold hover:bg-violet-500 disabled:opacity-50"
                      >
                        Record now
                      </button>
                    )}

                    <button
                      onClick={() => toggleRecurring(plan)}
                      className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
                    >
                      {plan.is_active ? (
                        <>
                          <Pause size={14} /> Pause
                        </>
                      ) : (
                        <>
                          <Play size={14} /> Resume
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => deleteRecurring(plan)}
                      className="rounded-lg border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CONTRIBUTION HISTORY */}

        <section className="rounded-2xl border border-white/10 bg-[#151722] p-5 md:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/15 p-3 text-emerald-300">
                <History size={21} />
              </div>
              <div>
                <h2 className="font-semibold">Contribution history</h2>
                <p className="text-xs text-gray-400">
                  Your recent savings deposits
                </p>
              </div>
            </div>

            <span className="text-xs text-gray-400">
              {contributions.length} records
            </span>
          </div>

          {contributions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-7 text-center">
              <Wallet size={28} className="mx-auto mb-3 text-gray-500" />
              <p className="text-sm text-gray-300">
                No contributions recorded yet.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Add money to a goal to see your history here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[550px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-gray-500">
                    <th className="pb-3 font-medium">Goal</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Note</th>
                    <th className="pb-3 text-right font-medium">Amount</th>
                    <th className="pb-3 text-right font-medium">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {contributions.slice(0, 30).map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="py-4 font-medium">
                        {getGoalName(item.goal_id)}
                      </td>

                      <td className="py-4 text-gray-400">
                        {dateFormat(item.contribution_date)}
                      </td>

                      <td className="py-4 text-gray-500">{item.note || "—"}</td>

                      <td className="py-4 text-right font-semibold text-emerald-300">
                        +{currency(Number(item.amount))}
                      </td>

                      <td className="py-4 text-right">
                        <button
                          onClick={() => deleteContribution(item)}
                          title="Delete contribution"
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {contributions.length > 30 && (
                <p className="mt-3 text-xs text-gray-500">
                  Showing the 30 most recent contributions. Export CSV or PDF to
                  include the full history.
                </p>
              )}
            </div>
          )}
        </section>

        {/* FOOTER */}

        <footer className="flex flex-col justify-between gap-2 border-t border-white/5 py-5 text-xs text-gray-500 sm:flex-row">
          <span>RV SpendWise · Savings Goals</span>
          <span>
            Your savings contributions are stored separately from expenses.
          </span>
        </footer>
      </div>

      {/* CREATE / EDIT GOAL MODAL */}

      {goalModal && (
        <Modal onClose={() => setGoalModal(false)}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {editingGoal ? "Edit savings goal" : "Create savings goal"}
            </h2>
            <button
              onClick={() => setGoalModal(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-white/5"
            >
              <X size={19} />
            </button>
          </div>

          <form onSubmit={saveGoal} className="space-y-4">
            <FormField label="Goal name">
              <input
                required
                value={goalForm.name}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, name: e.target.value })
                }
                placeholder="Example: New laptop"
                className="form-input"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                value={goalForm.description}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, description: e.target.value })
                }
                placeholder="What are you saving for?"
                rows={2}
                className="form-input resize-none"
              />
            </FormField>

            <FormField label="Target amount (₹)">
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={goalForm.target_amount}
                onChange={(e) =>
                  setGoalForm({
                    ...goalForm,
                    target_amount: e.target.value,
                  })
                }
                placeholder="50000"
                className="form-input"
              />
            </FormField>

            <FormField label="Target date">
              <input
                type="date"
                min={todayString()}
                value={goalForm.target_date}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, target_date: e.target.value })
                }
                className="form-input"
              />
            </FormField>

            <FormField label="Priority">
              <select
                value={goalForm.priority}
                onChange={(e) =>
                  setGoalForm({
                    ...goalForm,
                    priority: e.target.value as GoalForm["priority"],
                  })
                }
                className="form-input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </FormField>

            <FormField label="Goal status">
              <select
                value={editingGoal?.status || "active"}
                disabled={!editingGoal}
                onChange={(e) => {
                  if (editingGoal) {
                    setEditingGoal({
                      ...editingGoal,
                      status: e.target.value as Goal["status"],
                    });
                  }
                }}
                className="form-input"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </FormField>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-violet-600 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingGoal
                  ? "Update goal"
                  : "Create goal"}
            </button>
          </form>
        </Modal>
      )}

      {/* ADD CONTRIBUTION MODAL */}

      {contributionModal && (
        <Modal onClose={() => setContributionModal(false)}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">Add money</h2>
            <button
              onClick={() => setContributionModal(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-white/5"
            >
              <X size={19} />
            </button>
          </div>

          <p className="mb-4 text-sm text-gray-400">
            Adding money to:{" "}
            <span className="font-semibold text-violet-300">
              {getGoalName(selectedGoal)}
            </span>
          </p>

          <form onSubmit={addContribution} className="space-y-4">
            <FormField label="Amount (₹)">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                placeholder="5000"
                className="form-input"
              />
            </FormField>

            <FormField label="Contribution date">
              <input
                required
                type="date"
                max={todayString()}
                value={contributionDate}
                onChange={(e) => setContributionDate(e.target.value)}
                className="form-input"
              />
            </FormField>

            <FormField label="Note (optional)">
              <input
                value={contributionNote}
                onChange={(e) => setContributionNote(e.target.value)}
                placeholder="Monthly savings"
                className="form-input"
              />
            </FormField>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-emerald-600 py-3 font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Confirm contribution"}
            </button>
          </form>
        </Modal>
      )}

      {/* RECURRING MODAL */}

      {recurringModal && (
        <Modal onClose={() => setRecurringModal(false)}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold">Recurring contribution</h2>
            <button
              onClick={() => setRecurringModal(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-white/5"
            >
              <X size={19} />
            </button>
          </div>

          <p className="mb-4 text-sm text-gray-400">
            Goal:{" "}
            <span className="font-semibold text-violet-300">
              {getGoalName(selectedGoal)}
            </span>
          </p>

          <form onSubmit={addRecurringPlan} className="space-y-4">
            <FormField label="Contribution amount (₹)">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={recurringAmount}
                onChange={(e) => setRecurringAmount(e.target.value)}
                placeholder="2000"
                className="form-input"
              />
            </FormField>

            <FormField label="Frequency">
              <select
                value={recurringFrequency}
                onChange={(e) =>
                  setRecurringFrequency(e.target.value as "weekly" | "monthly")
                }
                className="form-input"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </FormField>

            <FormField label="First reminder date">
              <input
                required
                type="date"
                min={todayString()}
                value={recurringDate}
                onChange={(e) => setRecurringDate(e.target.value)}
                className="form-input"
              />
            </FormField>

            <div className="rounded-lg bg-violet-500/10 p-3 text-xs leading-5 text-violet-200">
              This creates an in-app reminder. Contributions are only added
              after you confirm them; no automatic bank transfer takes place.
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-violet-600 py-3 font-semibold hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create recurring plan"}
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}

function OverviewCard({
  title,
  amount,
  icon,
  detail,
  color,
}: {
  title: string;
  amount: string;
  icon: React.ReactNode;
  detail: string;
  color: "violet" | "emerald" | "blue" | "amber";
}) {
  const colors = {
    violet: "bg-violet-500/15 text-violet-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    blue: "bg-blue-500/15 text-blue-300",
    amber: "bg-amber-500/15 text-amber-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#151722] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{title}</p>
        <div className={`rounded-xl p-2.5 ${colors[color]}`}>{icon}</div>
      </div>

      <p className="mt-4 text-2xl font-bold tracking-tight">{amount}</p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#171925] p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-gray-300">{label}</span>
      {children}
    </label>
  );
}
