import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import groupService from '../../services/group.service';
import useAuth from '../../hooks/useAuth';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import GroupBalancesTab from './GroupBalancesTab';
import InviteMemberModal from './InviteMemberModal';

import CreateExpenseModal from '../expenses/CreateExpenseModal';
import expenseService from '../../services/expense.service';
import { getInitials, formatINR } from '../../utils/formatters';
import {
  Users,
  UserPlus,
  ArrowLeft,
  Crown,
  Trash2,
  Copy,
  Check,
  Receipt,
  Wallet,
  Loader2,
  AlertCircle,
  Plus
} from 'lucide-react';

export const GroupDetailPage = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCreateExpenseModalOpen, setIsCreateExpenseModalOpen] = useState(false);
  const [groupExpenses, setGroupExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'balances', 'expenses'

  const fetchGroupExpenses = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoadingExpenses(true);
      const data = await expenseService.getExpenses({ group_id: groupId });
      setGroupExpenses(data);
    } catch (err) {
      console.error('Failed to load group expenses:', err);
    } finally {
      setLoadingExpenses(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (activeTab === 'expenses') {
      fetchGroupExpenses();
    }
  }, [activeTab, fetchGroupExpenses]);

  const fetchGroupDetails = useCallback(async () => {
    try {
      setLoading(true);
      const groupData = await groupService.getGroup(groupId);
      setGroup(groupData);
      setMembers(groupData.members || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load group details.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroupDetails();
  }, [fetchGroupDetails]);

  const handleCopyCode = () => {
    if (group?.invite_code) {
      navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!window.confirm('Are you sure you want to remove this member from the group?')) {
      return;
    }

    try {
      await groupService.removeMember(groupId, memberUserId);
      fetchGroupDetails();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove member.');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to delete this group? All group data will be deleted.')) {
      return;
    }

    try {
      await groupService.deleteGroup(groupId);
      navigate('/groups');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete group.');
    }
  };

  const isAdmin = group?.user_role === 'ADMIN';

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading group details...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <Card className="py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-slate-800">{error || 'Group not found.'}</p>
        <Link to="/groups">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Groups
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/groups" className="inline-flex items-center text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Groups
      </Link>

      {/* Group Detail Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{group.name}</h1>
              <Badge variant="brand">{group.group_type}</Badge>
            </div>
            {group.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">{group.description}</p>
            )}
            
            {/* Invite Code Bar */}
            <div className="pt-1 flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Invite Code:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 tracking-wider">
                {group.invite_code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                title="Copy Invite Code"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <Button variant="primary" onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Add Member
            </Button>
            {isAdmin && (
              <Button variant="danger" onClick={handleDeleteGroup} title="Delete Group">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex space-x-6 text-sm font-semibold pb-px">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`relative pb-3 transition-colors flex items-center space-x-2 cursor-pointer ${
              activeTab === 'members'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members ({members.length})</span>
            {activeTab === 'members' && (
              <motion.div
                layoutId="groupDetailActiveTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('balances')}
            className={`relative pb-3 transition-colors flex items-center space-x-2 cursor-pointer ${
              activeTab === 'balances'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Balances</span>
            {activeTab === 'balances' && (
              <motion.div
                layoutId="groupDetailActiveTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`relative pb-3 transition-colors flex items-center space-x-2 cursor-pointer ${
              activeTab === 'expenses'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Expenses</span>
            {activeTab === 'expenses' && (
              <motion.div
                layoutId="groupDetailActiveTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
                transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'members' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Group Members</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{members.length} Total</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((m) => {
              const isMemberSelf = strUserEqual(user?.id, m.user.id);

              return (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center border border-emerald-200 dark:border-emerald-800/80">
                      {getInitials(m.user.first_name, m.user.last_name)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {m.user.first_name} {m.user.last_name} {isMemberSelf && '(You)'}
                        </p>
                        {m.role === 'ADMIN' && (
                          <span className="inline-flex items-center text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-800/60">
                            <Crown className="w-3 h-3 mr-0.5 text-amber-500" /> Admin
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{m.user.email}</p>
                    </div>
                  </div>

                  {(isAdmin || isMemberSelf) && (
                    <button
                      onClick={() => handleRemoveMember(m.user.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title={isMemberSelf ? "Leave Group" : "Remove Member"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'balances' && (
        <GroupBalancesTab
          groupId={groupId}
          members={members}
          currentUserId={user?.id}
        />
      )}


      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Expenses Logged ({groupExpenses.length})</h3>
            <Button variant="primary" size="sm" onClick={() => setIsCreateExpenseModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Log Expense
            </Button>
          </div>

          {loadingExpenses ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading group expenses...</p>
            </div>
          ) : groupExpenses.length === 0 ? (
            <Card className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="max-w-sm mx-auto space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">No expenses in this group yet</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Log an expense to split costs automatically across group members.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setIsCreateExpenseModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Log First Expense
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {groupExpenses.map((expense) => {
                const isPayer = expense.paid_by?.id === user?.id;

                return (
                  <Card key={expense.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 shadow-2xs">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0 border border-emerald-100 dark:border-emerald-900/50">
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{expense.description}</h4>
                            <Badge variant="neutral">{expense.category?.name || 'General'}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Paid by <strong className="text-slate-700 dark:text-slate-200">{isPayer ? 'You' : expense.paid_by?.first_name}</strong> on {expense.date} • <span className="text-emerald-700 dark:text-emerald-400 font-medium">{expense.split_type}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-extrabold text-slate-900 dark:text-white">{formatINR(expense.total_amount)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Your share: <strong className="text-slate-700 dark:text-slate-200">{formatINR(expense.my_share)}</strong></p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        group={group}
        onMemberAdded={fetchGroupDetails}
      />

      {/* Create Expense Modal */}
      <CreateExpenseModal
        isOpen={isCreateExpenseModalOpen}
        onClose={() => setIsCreateExpenseModalOpen(false)}
        initialGroupId={groupId}
        onExpenseCreated={() => {
          fetchGroupExpenses();
          fetchGroupDetails();
        }}
      />
    </div>
  );
};

const strUserEqual = (a, b) => String(a) === String(b);

export default GroupDetailPage;
