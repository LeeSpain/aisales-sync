
-- Drop all existing restrictive policies and recreate as permissive

-- Profiles
DROP POLICY "Users can view own profile" ON public.profiles;
DROP POLICY "Users can update own profile" ON public.profiles;
DROP POLICY "Users can insert own profile" ON public.profiles;
DROP POLICY "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Companies
DROP POLICY "Users can view own company" ON public.companies;
DROP POLICY "Users can update own company" ON public.companies;
DROP POLICY "Users can insert own company" ON public.companies;
DROP POLICY "Admins can view all companies" ON public.companies;
DROP POLICY "Admins can update all companies" ON public.companies;

CREATE POLICY "Users can view own company" ON public.companies FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.company_id = companies.id)
);
CREATE POLICY "Users can update own company" ON public.companies FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.company_id = companies.id)
);
CREATE POLICY "Users can insert own company" ON public.companies FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins can view all companies" ON public.companies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all companies" ON public.companies FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User roles
DROP POLICY "Users can view own roles" ON public.user_roles;
DROP POLICY "Admins can view all roles" ON public.user_roles;
DROP POLICY "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
