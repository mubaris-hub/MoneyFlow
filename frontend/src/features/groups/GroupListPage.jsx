import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import groupService from '../../services/group.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import CreateGroupModal from './CreateGroupModal';
import { getInitials } from '../../utils/formatters';
import {
  Users,
  Plus,
  ArrowRight,
  Copy,
  Check,
  Key,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const GroupListPage = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await groupService.getGroups();
      setGroups(data);
    } catch (err) {
      setError('Failed to load groups. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoinLoading(true);
    setJoinError('');

    try {
      const data = await groupService.joinGroupByCode(joinCode.trim());
      setJoinCode('');
      fetchGroups();
      navigate(`/groups/${data.group.id}`);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid or expired invite code.';
      setJoinError(msg);
    } finally {
      setJoinLoading(false);
    }
  };

  const getGroupTypeBadge = (type) => {
    switch (type) {
      case 'ROOMMATES': return <Badge variant="brand">Roommates</Badge>;
      case 'TRIP': return <Badge variant="success">Trip / Vacation</Badge>;
      case 'STUDENT_HOUSE': return <Badge variant="warning">Student House</Badge>;
      case 'COUPLE': return <Badge variant="danger">Couple</Badge>;
      default: return <Badge variant="neutral">Group</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading your groups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Your Groups</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track expenses and settle debts with roommates, trips, and friends.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create Group
        </Button>
      </div>

      {/* Quick Join via Code Bar */}
      <Card className="p-4 bg-slate-900 text-white border-0 shadow-md">
        <form onSubmit={handleJoinByCode} className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Have an Invite Code?</p>
              <p className="text-xs text-slate-400">Enter code to join an existing group instantly.</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="e.g. AB12CD34"
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.toUpperCase());
                if (joinError) setJoinError('');
              }}
              className="px-3.5 py-2 text-xs font-mono font-bold bg-slate-800 border border-slate-700 text-white rounded-lg focus:outline-none focus:border-emerald-500 uppercase placeholder:normal-case placeholder:font-normal"
            />
            <Button type="submit" variant="primary" size="md" isLoading={joinLoading}>
              Join
            </Button>
          </div>
        </form>
        {joinError && (
          <p className="mt-2 text-xs text-rose-400 font-medium flex items-center">
            <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
            {joinError}
          </p>
        )}
      </Card>

      {/* Groups List Grid */}
      {groups.length === 0 ? (
        <Card className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">No groups yet</h3>
            <p className="text-xs text-slate-500">
              Create a group for your apartment, trip, or event to start logging shared expenses.
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Create Your First Group
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map((group) => (
            <Card
              key={group.id}
              onClick={() => navigate(`/groups/${group.id}`)}
              className="cursor-pointer hover:border-emerald-500/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 hover:text-emerald-600 transition-colors">
                      {group.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {group.description || 'No description added.'}
                    </p>
                  </div>
                  {getGroupTypeBadge(group.group_type)}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                {/* Member Avatars Stack */}
                <div className="flex items-center space-x-2">
                  <div className="flex -space-x-2 overflow-hidden">
                    {group.members?.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white text-slate-700 flex items-center justify-center text-[10px] font-bold"
                        title={`${m.user.first_name} ${m.user.last_name}`}
                      >
                        {getInitials(m.user.first_name, m.user.last_name)}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    {group.members_count} {group.members_count === 1 ? 'member' : 'members'}
                  </span>
                </div>

                <div className="flex items-center text-xs font-semibold text-emerald-600 group-hover:translate-x-0.5 transition-transform">
                  View <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onGroupCreated={(newGroup) => {
          fetchGroups();
          navigate(`/groups/${newGroup.id}`);
        }}
      />
    </div>
  );
};

export default GroupListPage;
