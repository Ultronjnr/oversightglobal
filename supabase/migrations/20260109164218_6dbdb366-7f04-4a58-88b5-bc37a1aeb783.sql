-- Create role enum
CREATE TYPE public.app_role AS ENUM ('EMPLOYEE', 'HOD', 'FINANCE', 'ADMIN', 'SUPPLIER');

-- Create user status enum
CREATE TYPE public.user_status AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED');

-- Create organizations table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    company_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create profiles table (for auth users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    surname TEXT,
    department TEXT,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    status public.user_status DEFAULT 'ACTIVE' NOT NULL,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (SEPARATE from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create suppliers table
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    registration_number TEXT,
    industry TEXT,
    is_verified BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
$$;

-- Function to get user organization
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT organization_id
    FROM public.profiles
    WHERE id = _user_id
$$;

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
TO authenticated
USING (id = public.get_user_organization(auth.uid()));

CREATE POLICY "Admins can update their organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (id = public.get_user_organization(auth.uid()) AND public.has_role(auth.uid(), 'ADMIN'));

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
TO authenticated
USING (
    organization_id = public.get_user_organization(auth.uid())
    OR id = auth.uid()
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Anyone can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view roles in their org"
ON public.user_roles FOR SELECT
TO authenticated
USING (
    public.has_role(auth.uid(), 'ADMIN')
    AND EXISTS (
        SELECT 1 FROM public.profiles p1, public.profiles p2
        WHERE p1.id = auth.uid()
        AND p2.id = user_roles.user_id
        AND p1.organization_id = p2.organization_id
    )
);

CREATE POLICY "Users can insert their own role during signup"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- RLS Policies for suppliers
CREATE POLICY "Suppliers can view their own data"
ON public.suppliers FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Suppliers can update their own data"
ON public.suppliers FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own supplier profile"
ON public.suppliers FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Verified suppliers are viewable by authenticated users"
ON public.suppliers FOR SELECT
TO authenticated
USING (is_verified = true);

-- Function to check if organization has admin
CREATE OR REPLACE FUNCTION public.organization_has_admin(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        WHERE p.organization_id = _org_id
        AND ur.role = 'ADMIN'
    )
$$;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();