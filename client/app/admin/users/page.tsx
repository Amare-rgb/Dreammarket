// app/admin/users/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import axios, { AxiosError } from "axios";
import { Users, Search, Filter, ChevronDown, Trash2, Eye, CheckCircle, XCircle, Mail, Phone, RefreshCw, Shield, ShieldCheck, AlertCircle, Info, X, User, Calendar } from "lucide-react";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/+$/, "");

const api = axios.create({ baseURL: API_URL, headers: { "Content-Type": "application/json" }, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      ["token", "authToken", "user"].forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    }
    return Promise.reject(error);
  }
);

type Role = "USER" | "ADMIN";
interface UserRecord { id: string; name: string; email: string; phone: string | null; role: Role; avatar: string | null; createdAt: string; updatedAt: string; }

const formatDate = (d: string) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "N/A";

const ROLE_META: Record<Role, { color: string; icon: React.ReactNode; label: string }> = {
  ADMIN: { color: "bg-purple-100 text-purple-700 border-purple-200", icon: <ShieldCheck className="w-4 h-4" />, label: "Admin" },
  USER: { color: "bg-gray-100 text-gray-700 border-gray-200", icon: <Shield className="w-4 h-4" />, label: "User" },
};

const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token") || sessionStorage.getItem("token") || localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
};

type NotifType = "success" | "error" | "info" | "warning";
const NOTIF_STYLES: Record<NotifType, string> = {
  success: "bg-yellow-50 border-yellow-200 text-yellow-800", error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800", info: "bg-blue-50 border-blue-200 text-blue-800",
};
const NOTIF_ICONS: Record<NotifType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-yellow-500" />, error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertCircle className="w-5 h-5 text-yellow-500" />, info: <Info className="w-5 h-5 text-blue-500" />,
};

const Notification: React.FC<{ type: NotifType; message: string; onClose: () => void }> = ({ type, message, onClose }) => {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300); }, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"}`}>
      <div className={`flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg max-w-md ${NOTIF_STYLES[type]}`}>
        {NOTIF_ICONS[type]}<p className="text-sm font-medium flex-1">{message}</p>
        <button onClick={() => { setVisible(false); setTimeout(onClose, 300); }} className="text-gray-400 hover:text-gray-600"><XCircle className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

const RoleBadge: React.FC<{ role: Role }> = ({ role }) => {
  const meta = ROLE_META[role] || ROLE_META.USER;
  return <span className={`inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded-full border ${meta.color}`}>{meta.icon}<span>{meta.label}</span></span>;
};

const UserDetailModal: React.FC<{ user: UserRecord | null; isOpen: boolean; onClose: () => void }> = ({ user, isOpen, onClose }) => {
  if (!isOpen || !user) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div><h2 className="text-lg font-semibold text-gray-900">User Details</h2><p className="text-xs text-gray-500">View user information</p></div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 text-xl font-bold">{user.name.charAt(0).toUpperCase()}</div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{user.name}</h3>
              <div className="flex items-center space-x-2 text-sm text-gray-500"><Mail className="w-4 h-4" /><span>{user.email || "No email"}</span></div>
              <div className={`flex items-center space-x-2 text-sm ${user.phone ? "text-gray-500" : "text-gray-400"}`}><Phone className="w-4 h-4" /><span>{user.phone || "No phone number"}</span></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2"><User className="w-4 h-4 text-gray-500" /><span>Account Details</span></h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">User ID:</span><span className="text-gray-700 font-mono">{user.id.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Role:</span><RoleBadge role={user.role} /></div>
                <div className="flex justify-between"><span className="text-gray-500">Avatar:</span><span className="text-gray-700">{user.avatar ? "Yes" : "No"}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center space-x-2"><Calendar className="w-4 h-4 text-gray-500" /><span>Activity</span></h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Joined:</span><span className="text-gray-700">{formatDate(user.createdAt)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Last Updated:</span><span className="text-gray-700">{formatDate(user.updatedAt)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const UsersPage: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [notification, setNotification] = useState<{ type: NotifType; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);

  const isMounted = useRef(true);
  const isInitialMount = useRef(true);

  const showNotification = (type: NotifType, message: string) => setNotification({ type, message });
  const clearNotification = () => setNotification(null);
  const roles = ["ALL", "USER", "ADMIN"];

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      if (!getToken()) { showNotification("error", "Authentication required. Please login again."); router.push("/auth/signin"); return; }
      const params = new URLSearchParams();
      if (selectedRole !== "ALL") params.append("role", selectedRole);
      if (searchQuery) params.append("search", searchQuery);
      params.append("page", currentPage.toString());
      params.append("limit", pageSize.toString());
      const response = await api.get(`/api/users?${params.toString()}`);
      if (!isMounted.current) return;
      let usersData: UserRecord[] = [];
      let totalCount = 0;
      if (response.data && response.data.users) { usersData = response.data.users; totalCount = response.data.total || usersData.length; }
      else if (Array.isArray(response.data)) { usersData = response.data; totalCount = usersData.length; }
      setUsers(usersData); setTotal(totalCount); setTotalPages(Math.max(1, Math.ceil(totalCount / pageSize)));
    } catch (err: unknown) {
      console.error("❌ Fetch error:", err);
      if (!isMounted.current) return;
      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError<{ error: string }>;
        if (axiosError.response?.status === 401 || axiosError.response?.status === 403) { showNotification("error", "Authentication failed. Please login again."); router.push("/auth/signin"); }
        else showNotification("error", axiosError.response?.data?.error || "Failed to fetch users");
      } else showNotification("error", err instanceof Error ? err.message : "An unexpected error occurred");
    } finally { if (isMounted.current) setLoading(false); }
  }, [selectedRole, searchQuery, currentPage, pageSize, router]);

  useEffect(() => {
    isMounted.current = true;
    if (isInitialMount.current) { isInitialMount.current = false; fetchUsers(); }
    return () => { isMounted.current = false; };
  }, [fetchUsers]);

  useEffect(() => { if (isInitialMount.current) return; fetchUsers(); }, [selectedRole, searchQuery, currentPage, fetchUsers]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); setCurrentPage(1); };
  const handleRoleChange = (value: string) => { setSelectedRole(value); setCurrentPage(1); };
  const handleClearFilters = () => { setSelectedRole("ALL"); setSearchQuery(""); setCurrentPage(1); };
  const handleRefresh = () => { showNotification("info", "Refreshing users..."); fetchUsers(); };
  const handleViewUser = (user: UserRecord) => { setSelectedUser(user); setIsModalOpen(true); };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete user "${name}"? This action cannot be undone.`)) return;
    try {
      const response = await api.delete(`/api/users/${id}`);
      if (response.data.success) { showNotification("success", `User "${name}" deleted successfully`); await fetchUsers(); }
      else showNotification("error", response.data.error || "Failed to delete user");
    } catch (err) {
      console.error("Error deleting user:", err);
      if (axios.isAxiosError(err)) showNotification("error", err.response?.data?.error || "Failed to delete user");
      else showNotification("error", "An unexpected error occurred");
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto"></div><p className="mt-4 text-gray-600">Loading users...</p></div></div>;

  return (
    <div className="space-y-6">
      {notification && <Notification type={notification.type} message={notification.message} onClose={clearNotification} />}
      <UserDetailModal user={selectedUser} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Users</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage user accounts and permissions</p>
          <p className="text-xs text-gray-400 mt-1">Total: {total} users</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3"><p className="text-xs text-gray-500">Total Users</p><p className="text-lg font-bold text-gray-900">{total}</p></div>

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search users by name, email, or phone..." value={searchQuery} onChange={handleSearchChange} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all text-sm" />
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => setShowFilters(!showFilters)} className="flex items-center space-x-2 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><Filter className="w-3.5 h-3.5" /><span>Filters</span><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} /></button>
          <button onClick={handleRefresh} className="flex items-center space-x-2 px-3 py-1.5 text-xs text-white bg-[#EB6D3D] rounded-lg hover:bg-[#cf5427] transition-colors"><RefreshCw className="w-3.5 h-3.5" /><span>Refresh</span></button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Role</label>
            <select value={selectedRole} onChange={(e) => handleRoleChange(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm">
              {roles.map((role) => <option key={role} value={role}>{role === "ALL" ? "All Roles" : ROLE_META[role as Role]?.label || role}</option>)}
            </select>
          </div>
          <div className="flex items-end"><button onClick={handleClearFilters} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Clear Filters</button></div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {users.length > 0 ? (
            <table className="w-full min-w-[800px]">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                {["User", "Contact", "Role", "Joined"].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleViewUser(user)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700 font-semibold text-sm flex-shrink-0">{user.name.charAt(0).toUpperCase()}</div>
                        <div><p className="text-sm font-medium text-gray-900">{user.name}</p><p className="text-xs text-gray-500 truncate max-w-[200px]">{user.email || "No email"}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.phone ? <div className="flex items-center space-x-1 text-xs text-gray-500"><Phone className="w-3 h-3" /><span>{user.phone}</span></div> : <span className="text-xs text-gray-400">No phone</span>}
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-3"><div className="text-xs text-gray-500 whitespace-nowrap">{formatDate(user.createdAt)}</div></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button onClick={(e) => { e.stopPropagation(); handleViewUser(user); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="View User Details"><Eye className="w-4 h-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(user.id, user.name); }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete User"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm">No users found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>

        {total > pageSize && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} of {total}</p>
            <div className="flex space-x-2">
              <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
              <button onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage >= totalPages} className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersPage;