-- Run this after the base schema if admin/employer dashboard actions are blocked by RLS.
-- No extra tables are required for job posting; this only tightens dashboard access policies.

-- Make one account an admin. Replace the email before running.
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';

-- Make sure admins/employers can delete their own jobs.
drop policy if exists "Employers can delete own jobs" on public.jobs;
create policy "Employers can delete own jobs"
on public.jobs for delete
using (
  created_by = auth.uid()
  or public.current_user_role() = 'admin'
);

-- Make sure admins/employers can read applications for jobs they own.
drop policy if exists "Employers can view applications for own jobs" on public.applications;
create policy "Employers can view applications for own jobs"
on public.applications for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
    and j.created_by = auth.uid()
  )
  or public.current_user_role() = 'admin'
);

-- Make sure admins/employers can update candidate application status.
drop policy if exists "Employers can update applications for own jobs" on public.applications;
create policy "Employers can update applications for own jobs"
on public.applications for update
using (
  exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
    and j.created_by = auth.uid()
  )
  or public.current_user_role() = 'admin'
)
with check (
  exists (
    select 1
    from public.jobs j
    where j.id = applications.job_id
    and j.created_by = auth.uid()
  )
  or public.current_user_role() = 'admin'
);

-- Make sure admins/employers can read interviews attached to their jobs.
drop policy if exists "Employers can view interviews for own jobs" on public.interviews;
create policy "Employers can view interviews for own jobs"
on public.interviews for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.jobs j
    where j.id = interviews.job_id
    and j.created_by = auth.uid()
  )
  or public.current_user_role() = 'admin'
);
