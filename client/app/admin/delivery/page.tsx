"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

interface DeliveryRegion {
  id: string;
  name: string;
  country: string | null;
  fee: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}

interface RegionForm {
  name: string;
  country: string;
  fee: string;
  sortOrder: string;
  active: boolean;
}

const emptyForm: RegionForm = {
  name: "",
  country: "",
  fee: "",
  sortOrder: "0",
  active: true,
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(amount);

export default function AdminDeliveryPage() {
  const [regions, setRegions] = useState<DeliveryRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RegionForm>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/admin/delivery-regions");
      if (res.data?.success) setRegions(res.data.regions || []);
    } catch {
      setError("Failed to load delivery regions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchInitialRegions = async () => {
      try {
        const res = await api.get("/api/admin/delivery-regions");
        if (!cancelled) {
          if (res.data?.success) {
            setRegions(res.data.regions || []);
          }
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load delivery regions.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchInitialRegions();

    return () => {
      cancelled = true;
    };
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (region: DeliveryRegion) => {
    setEditingId(region.id);
    setForm({
      name: region.name,
      country: region.country || "",
      fee: String(region.fee ?? ""),
      sortOrder: String(region.sortOrder ?? 0),
      active: region.active,
    });
    setShowForm(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const fee = Number(form.fee);
    if (!form.name.trim() || !Number.isFinite(fee) || fee < 0) {
      setError("Provide a region name and a valid delivery fee.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        country: form.country.trim() || null,
        fee,
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active,
      };
      if (editingId) {
        await api.put(`/api/admin/delivery-regions/${editingId}`, payload);
      } else {
        await api.post("/api/admin/delivery-regions", payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      setError(msg || "Failed to save delivery region.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (region: DeliveryRegion) => {
    try {
      await api.put(`/api/admin/delivery-regions/${region.id}`, {
        active: !region.active,
      });
      await load();
    } catch {
      setError("Failed to update region.");
    }
  };

  const remove = async (region: DeliveryRegion) => {
    if (!window.confirm(`Delete delivery region "${region.name}"?`)) return;
    try {
      await api.delete(`/api/admin/delivery-regions/${region.id}`);
      await load();
    } catch {
      setError("Failed to delete region.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Regions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage delivery areas and their flat delivery fees shown at checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#cf5427] px-4 text-sm font-bold text-white transition hover:bg-[#9c3d1a]"
        >
          <Plus size={16} /> Add Region
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">
              {editingId ? "Edit Delivery Region" : "New Delivery Region"}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm font-semibold text-gray-700">
              Region / City name <span className="text-red-600">*</span>
              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Gondar Center"
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal outline-none focus:border-[#EB6D3D]"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Country / Zone
              <input
                maxLength={120}
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. Ethiopia"
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal outline-none focus:border-[#EB6D3D]"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Delivery fee (ETB) <span className="text-red-600">*</span>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
                placeholder="e.g. 100"
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal outline-none focus:border-[#EB6D3D]"
              />
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Sort order
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm font-normal outline-none focus:border-[#EB6D3D]"
              />
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 accent-[#cf5427]"
            />
            Active (visible at checkout)
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#cf5427] px-5 text-sm font-bold text-white hover:bg-[#9c3d1a] disabled:opacity-60"
            >
              {saving && <LoaderCircle size={15} className="animate-spin" />}
              {editingId ? "Save Changes" : "Create Region"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderCircle className="h-8 w-8 animate-spin text-[#cf5427]" />
          </div>
        ) : regions.length === 0 ? (
          <div className="py-16 text-center">
            <MapPin className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              No delivery regions yet. Add one so customers can select their area at checkout.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  Region
                </th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  Country / Zone
                </th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  Delivery Fee
                </th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  Order
                </th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {regions.map((region) => (
                <tr key={region.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900">
                    {region.name}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {region.country || "—"}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-[#9c3d1a]">
                    {money(Number(region.fee))}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {region.sortOrder}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(region)}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        region.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {region.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(region)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(region)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}