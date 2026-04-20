-- Migration: 015_planning_toolbox_schema.sql
-- Create standard tables for Guest List, Budget, Tasks, and Vendors

CREATE TABLE public.guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    rsvp_status TEXT DEFAULT 'Pending' CHECK (rsvp_status IN ('Pending', 'Attending', 'Declined')),
    dietary_notes TEXT,
    table_assignment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    vendor_name TEXT,
    is_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT,
    due_date DATE,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    contract_status TEXT DEFAULT 'Pending' CHECK (contract_status IN ('Pending', 'Signed', 'Completed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS enablement
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Policies
-- Guests
CREATE POLICY "Users can view guests for their events" 
    ON public.guests FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can insert guests for their events" 
    ON public.guests FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can update guests for their events" 
    ON public.guests FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can delete guests for their events" 
    ON public.guests FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = guests.event_id AND events.user_id = auth.uid()));

-- Budget Items
CREATE POLICY "Users can view budget for their events" 
    ON public.budget_items FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = budget_items.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can insert budget for their events" 
    ON public.budget_items FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE events.id = budget_items.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can update budget for their events" 
    ON public.budget_items FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = budget_items.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can delete budget for their events" 
    ON public.budget_items FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = budget_items.event_id AND events.user_id = auth.uid()));

-- Tasks
CREATE POLICY "Users can view tasks for their events" 
    ON public.tasks FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = tasks.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can insert tasks for their events" 
    ON public.tasks FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE events.id = tasks.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can update tasks for their events" 
    ON public.tasks FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = tasks.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can delete tasks for their events" 
    ON public.tasks FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = tasks.event_id AND events.user_id = auth.uid()));

-- Vendors
CREATE POLICY "Users can view vendors for their events" 
    ON public.vendors FOR SELECT 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = vendors.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can insert vendors for their events" 
    ON public.vendors FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM public.events WHERE events.id = vendors.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can update vendors for their events" 
    ON public.vendors FOR UPDATE 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = vendors.event_id AND events.user_id = auth.uid()));

CREATE POLICY "Users can delete vendors for their events" 
    ON public.vendors FOR DELETE 
    USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = vendors.event_id AND events.user_id = auth.uid()));
