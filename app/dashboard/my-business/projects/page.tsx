'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { 
  Plus, Target, Clock, CheckCircle, Pause, 
  TrendingUp, Users 
} from 'lucide-react';

interface Project {
  id: number;
  title: string;
  description: string;
  status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold';
  progress: number;
  start_date: string;
  target_date: string;
  impact_metrics?: string;
  created_at: string;
}

const statusColors = {
  'Planning': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Completed': 'bg-emerald-100 text-emerald-700',
  'On Hold': 'bg-gray-100 text-gray-700',
};

const statusIcons = {
  'Planning': Clock,
  'In Progress': TrendingUp,
  'Completed': CheckCircle,
  'On Hold': Pause,
};

export default function Projects() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    status: 'Planning' as Project['status'],
    progress: 0,
    target_date: '',
  });

  // Load company + projects
  useEffect(() => {
    const loadData = async () => {
      const storedId = localStorage.getItem('selectedCompanyId');
      if (!storedId) {
        setLoading(false);
        return;
      }

      setCompanyId(storedId);

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('profile_id', Number(storedId))
        .order('created_at', { ascending: false });

      if (data) setProjects(data);
      if (error) console.error(error);

      setLoading(false);
    };

    loadData();
  }, []);

  // Add new project
  const addProject = async () => {
    if (!newProject.title || !companyId) {
      toast.error('Project title is required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          profile_id: Number(companyId),
          title: newProject.title,
          description: newProject.description,
          status: newProject.status,
          progress: newProject.progress,
          target_date: newProject.target_date || null,
        })
        .select()
        .single();

      if (error) throw error;

      setProjects(prev => [data, ...prev]);
      setShowAddForm(false);
      setNewProject({
        title: '',
        description: '',
        status: 'Planning',
        progress: 0,
        target_date: '',
      });

      toast.success('Project created successfully');
    } catch (error: any) {
      toast.error('Failed to create project: ' + error.message);
    }
  };

  // Update project status
  const updateProjectStatus = async (id: number, newStatus: Project['status']) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setProjects(prev =>
        prev.map(p => (p.id === id ? { ...p, status: newStatus } : p))
      );
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  if (loading) {
    return <div className="p-12 text-center">Loading projects...</div>;
  }

  if (!companyId) {
    return (
      <div className="p-12 max-w-md mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">No Company Selected</h2>
        <p className="text-neutral-600 mb-6">Please select a company first.</p>
        <Link href="/dashboard/select-company" className="btn-primary px-8 py-3">
          Select Company
        </Link>
      </div>
    );
  }

  const activeProjects = projects.filter(p => p.status === 'In Progress').length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;

  return (
    <div className="px-4 md:px-8 lg:pr-12 py-8 lg:py-12 max-w-screen-2xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
        <div>
          <Link href="/dashboard/my-business" className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1 mb-2">
            ← Back to My Business
          </Link>
          <h1 className="font-black text-4xl md:text-5xl tracking-[-2px]">Projects</h1>
          <p className="text-xl text-neutral-600 mt-2">Track your key initiatives and impact</p>
        </div>

        <button 
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2 px-6 py-3 self-start md:self-auto"
        >
          <Plus className="w-5 h-5" /> New Project
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#00b4d8]/10 rounded-2xl">
              <Target className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Total Projects</p>
              <p className="text-3xl font-black">{projects.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-2xl">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Active Projects</p>
              <p className="text-3xl font-black">{activeProjects}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-neutral-200 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 rounded-2xl">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Completed</p>
              <p className="text-3xl font-black">{completedProjects}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8">
        <h2 className="text-2xl font-bold mb-6">All Projects</h2>

        {projects.length > 0 ? (
          <div className="space-y-4">
            {projects.map((project) => {
              const StatusIcon = statusIcons[project.status];
              return (
                <div key={project.id} className="border border-neutral-200 rounded-2xl p-6 hover:shadow-sm transition-shadow">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">{project.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[project.status]}`}>
                          {project.status}
                        </span>
                      </div>
                      <p className="text-neutral-600 mb-4">{project.description}</p>

                      {project.impact_metrics && (
                        <div className="text-sm text-neutral-500">
                          <strong>Impact:</strong> {project.impact_metrics}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 lg:items-end">
                      <select 
                        value={project.status} 
                        onChange={(e) => updateProjectStatus(project.id, e.target.value as Project['status'])}
                        className="input text-sm py-2"
                      >
                        <option value="Planning">Planning</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="On Hold">On Hold</option>
                      </select>

                      {project.target_date && (
                        <div className="text-sm text-neutral-500 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Target: {new Date(project.target_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <Target className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
            <p>No projects yet. Create your first project to get started.</p>
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-6">Create New Project</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Project Title</label>
                <input 
                  type="text" 
                  className="input w-full mt-1" 
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                  placeholder="e.g. Nongoma Pilot Program"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  className="input w-full mt-1 h-24" 
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Brief description of the project..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select 
                    className="input w-full mt-1"
                    value={newProject.status}
                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value as Project['status'] })}
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Target Date</label>
                  <input 
                    type="date" 
                    className="input w-full mt-1"
                    value={newProject.target_date}
                    onChange={(e) => setNewProject({ ...newProject, target_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-3 rounded-2xl border border-neutral-300 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button 
                onClick={addProject}
                className="flex-1 btn-primary py-3"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}