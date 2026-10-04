import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import StatCard from '../../components/common/StatCard';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import CreateGroupModal from '../groups/CreateGroupModal';
import {
  Wallet,
  ArrowDownLeft,
  Receipt,
  HandCoins,
  Sparkles,
  Users,
  Plus,
  ArrowUpRight
} from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white shadow-md shadow-emerald-600/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-xs px-3 py-1 rounded-full text-xs font-medium text-emerald-100 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Phase 2 Active Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {getGreeting()}, {user?.first_name || 'Friend'} 👋
            </h1>
            <p className="text-sm text-emerald-100 font-medium">
              Your shared money overview at a glance.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center space-x-2 cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Create Group</span>
            </button>
            <Link to="/groups">
              <button className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition-colors flex items-center space-x-2">
                <span>View Groups</span>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title="Available Balance"
          value="₹0"
          subtitle="Net balance across all groups"
          icon={Wallet}
          iconBg="bg-emerald-100 text-emerald-700"
          trend={
            <span className="inline-flex items-center text-slate-500">
              <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-slate-400" /> Fully settled up
            </span>
          }
        />

        <StatCard
          title="Money Received"
          value="₹0"
          subtitle="Total repayments received"
          icon={ArrowDownLeft}
          iconBg="bg-teal-100 text-teal-700"
          trend={
            <span className="inline-flex items-center text-slate-500">
              0 direct transfers
            </span>
          }
        />

        <StatCard
          title="Total Expenses"
          value="₹0"
          subtitle="Your total shared share"
          icon={Receipt}
          iconBg="bg-sky-100 text-sky-700"
          trend={
            <span className="inline-flex items-center text-slate-500">
              0 active expenses
            </span>
          }
        />

        <StatCard
          title="Pending Settlements"
          value="₹0"
          subtitle="Settlements to be cleared"
          icon={HandCoins}
          iconBg="bg-amber-100 text-amber-700"
          trend={
            <span className="inline-flex items-center text-slate-500">
              0 pending requests
            </span>
          }
        />
      </div>

      {/* Overview Dashboard Shell & Next Steps Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Activity</h3>
              <p className="text-xs text-slate-500">Groups and shared expenses feed</p>
            </div>
            <Badge variant="brand">Phase 2 Enabled</Badge>
          </div>

          <div className="py-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="max-w-sm mx-auto space-y-2">
              <p className="text-sm font-semibold text-slate-800">Group Management is active!</p>
              <p className="text-xs text-slate-500">
                You can now create groups, invite friends via unique codes, and manage memberships. Multi-person expense logging arrives in Phase 3.
              </p>
              <div className="pt-2">
                <Link to="/groups">
                  <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors">
                    Go to Groups
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-900">Account Overview</h3>
            <p className="text-xs text-slate-500">Verified session details</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">User ID</span>
              <span className="font-mono text-slate-700 text-[11px] truncate max-w-[150px]">{user?.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Email</span>
              <span className="font-semibold text-slate-800">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Username</span>
              <span className="font-semibold text-slate-800">{user?.username}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Default Currency</span>
              <Badge variant="brand">{user?.default_currency || 'INR'}</Badge>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500 font-medium">Auth Token</span>
              <span className="font-medium text-emerald-600">JWT Active</span>
            </div>
          </div>
        </Card>
      </div>

      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onGroupCreated={(group) => navigate(`/groups/${group.id}`)}
      />
    </div>
  );
};

export default DashboardPage;
