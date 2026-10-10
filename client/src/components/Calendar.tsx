import { useState, useEffect } from 'react';
import api from '../api';
import type { Job, Site, Service, BusinessEntity, Subcontractor, ContactMatrix } from '../types';

interface CalendarProps {
  sites: Site[];
  services: Service[];
  entities: BusinessEntity[];
  subcontractors: Subcontractor[];
  contactMatrix: ContactMatrix[];
  refresh: () => void;
}

export default function Calendar({ refresh }: CalendarProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadCalendar();
  }, [refresh, currentMonth, currentYear]);

  const loadCalendar = async () => {
    try {
      const data = await api.getCalendar(currentMonth, currentYear);
      setJobs(data);
    } catch (err) {
      console.error('Failed to load calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('en-GB', { month: 'long' });

  const getJobsForDay = (day: number) => {
    const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return jobs.filter(j => j.authorised_date === dateStr);
  };

  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  if (loading) {
    return <div className="app-loading"><div className="loading-spinner" /><p>Loading calendar...</p></div>;
  }

  return (
    <div className="tab-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Calendar</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}>&larr; Prev</button>
          <span style={{ fontWeight: 600, minWidth: '120px', textAlign: 'center' }}>{monthName} {currentYear}</span>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>Next &rarr;</button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: 'var(--ink-muted)', padding: '0.5rem' }}>
              {day}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: '80px' }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayJobs = getJobsForDay(day);
            return (
              <div
                key={day}
                style={{
                  minHeight: '80px',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: dayJobs.length > 0 ? 'var(--action-blue-light)' : 'var(--canvas)',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>{day}</div>
                {dayJobs.slice(0, 2).map(job => (
                  <div
                    key={job.id}
                    style={{
                      fontSize: '0.625rem',
                      padding: '0.125rem 0.25rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--canvas-raised)',
                      marginBottom: '0.125rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {job.site_name}
                  </div>
                ))}
                {dayJobs.length > 2 && (
                  <div style={{ fontSize: '0.625rem', color: 'var(--ink-muted)' }}>+{dayJobs.length - 2} more</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
