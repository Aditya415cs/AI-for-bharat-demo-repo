import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Briefcase, Users, LogOut, Plus, Filter, Search, ChevronRight } from 'lucide-react';
import { supabase } from './lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// Mock Data for Analytics
const data = [
  { name: 'Mon', apps: 4 },
  { name: 'Tue', apps: 7 },
  { name: 'Wed', apps: 5 },
  { name: 'Thu', apps: 12 },
  { name: 'Fri', apps: 18 },
  { name: 'Sat', apps: 10 },
  { name: 'Sun', apps: 3 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobs, setJobs] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: jobsData } = await supabase.from('jobs').select('*, companies(company_name)');
    const { data: appsData } = await supabase.from('applications').select('*, profiles(full_name, trade), jobs(title)');
    const { data: interviewData } = await supabase.from('interviews').select('*');

    setJobs(jobsData || []);
    
    // Combine application and interview data for candidates view
    const candidatesList = appsData?.map(app => {
      const interview = interviewData?.find(i => i.user_id === app.user_id && i.job_id === app.job_id);
      return {
        ...app,
        interview
      };
    }) || [];
    
    setCandidates(candidatesList);
    setLoading(false);
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.025em' }}>AI SkillFit</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Employer Portal</p>
        </div>
        
        <nav style={{ flex: 1 }}>
          <NavItem icon={<LayoutDashboard size={20}/>} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<Briefcase size={20}/>} label="Job Management" active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} />
          <NavItem icon={<Users size={20}/>} label="Candidates" active={activeTab === 'candidates'} onClick={() => setActiveTab('candidates')} />
        </nav>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <NavItem icon={<LogOut size={20}/>} label="Logout" active={false} onClick={() => {}} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardView jobs={jobs} candidates={candidates} />}
        {activeTab === 'jobs' && <JobsView jobs={jobs} onRefresh={fetchData} />}
        {activeTab === 'candidates' && <CandidatesView candidates={candidates} />}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem', 
        padding: '0.875rem 1rem', 
        borderRadius: '10px',
        cursor: 'pointer',
        marginBottom: '0.5rem',
        backgroundColor: active ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--muted)',
        fontWeight: active ? 700 : 500,
        transition: 'all 0.2s'
      }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function DashboardView({ jobs, candidates }: any) {
  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Welcome back, Employer</h2>
        <p style={{ color: 'var(--muted)' }}>Here is what's happening with your job postings today.</p>
      </header>

      <div className="stats-grid">
        <div className="card stat-card">
          <h3>Active Jobs</h3>
          <div className="value">{jobs.length}</div>
        </div>
        <div className="card stat-card">
          <h3>Total Applicants</h3>
          <div className="value">{candidates.length}</div>
        </div>
        <div className="card stat-card">
          <h3>Interviewed</h3>
          <div className="value">{candidates.filter((c: any) => c.interview).length}</div>
        </div>
        <div className="card stat-card">
          <h3>Hiring Rate</h3>
          <div className="value">12%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Application Trends</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="apps" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem' }}>Skills Distribution</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Electrical', val: 40 },
                { name: 'Driving', val: 30 },
                { name: 'Plumbing', val: 20 },
              ]}>
                <XAxis dataKey="name" />
                <Bar dataKey="val" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function JobsView({ jobs, onRefresh }: any) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Job Management</h2>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} /> Post New Job
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Job Title</th>
              <th>Trade</th>
              <th>Location</th>
              <th>Applicants</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job: any) => (
              <tr key={job.id}>
                <td style={{ fontWeight: 600 }}>{job.title}</td>
                <td>{job.trade}</td>
                <td>{job.location}</td>
                <td>{job.openings} Openings</td>
                <td>
                  <span className={`badge ${job.status === 'open' ? 'badge-success' : 'badge-danger'}`}>
                    {job.status}
                  </span>
                </td>
                <td>
                  <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CandidatesView({ candidates }: any) {
  return (
    <div>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Applicants</h2>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--muted)' }} />
            <input type="text" placeholder="Search candidates..." style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid var(--border)' }} />
          </div>
          <button className="btn" style={{ background: 'white', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} /> Filters
          </button>
        </div>
      </header>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Job Applied</th>
              <th>Score</th>
              <th>Status</th>
              <th>Classification</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((cand: any) => (
              <tr key={cand.id}>
                <td style={{ fontWeight: 600 }}>{cand.profiles?.full_name}</td>
                <td>{cand.jobs?.title}</td>
                <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                  {cand.interview?.score ? `${cand.interview.score}%` : 'N/A'}
                </td>
                <td>
                  <span className={`badge ${cand.status === 'applied' ? 'badge-warning' : 'badge-success'}`}>
                    {cand.status}
                  </span>
                </td>
                <td>
                  {cand.interview?.classification || '-'}
                </td>
                <td>
                  <ChevronRight size={20} style={{ color: 'var(--muted)', cursor: 'pointer' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
