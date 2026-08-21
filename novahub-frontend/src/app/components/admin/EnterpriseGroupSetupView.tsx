import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  GitBranch,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { enterpriseGroupsService } from "../../services/enterprise-groups.service";
import { storageService } from "../../services/storage.service";
import { authService } from "../../services/auth.service";
import { GroupManagerSupportDialog } from "./GroupManagerSupportDialog";
import { GroupBranchSupportDialog } from "./GroupBranchSupportDialog";
import { BrandLogo } from "../BrandLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  getPasswordError,
  isValidEmail,
  normalizeEmail,
} from "../../utils/accountValidation";
import { getBusinessTypeLabel } from "../../constants/businessTypes";
import {
  DEFAULT_ENTERPRISE_MODULES,
  ENTERPRISE_MODULE_OPTIONS,
} from "../../constants/enterpriseModules";

type SetupMode = "create" | "edit";
type SetupStep = "identity" | "units" | "warehouses" | "branches" | "summary";
type EditTab = "overview" | "identity" | "managers" | "users" | "units" | "warehouses" | "branches";

const steps: Array<{
  id: SetupStep;
  label: string;
  caption: string;
  icon: typeof Building2;
}> = [
  {
    id: "identity",
    label: "Identidad y Manager",
    caption: "Datos base y acceso principal",
    icon: ShieldCheck,
  },
  {
    id: "units",
    label: "Rubros",
    caption: "Separar catálogos y operación",
    icon: GitBranch,
  },
  {
    id: "branches",
    label: "Sucursales",
    caption: "Empresas operativas y bodegas",
    icon: Building2,
  },
  {
    id: "warehouses",
    label: "Almacenes",
    caption: "Abastecimiento autorizado",
    icon: Warehouse,
  },
  {
    id: "summary",
    label: "Resumen",
    caption: "Validar jerarquía del grupo",
    icon: CheckCircle2,
  },
];

const inputClass =
  "mt-2 h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelClass = "space-y-1 text-xs font-bold text-muted-foreground";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function dataUrlToFile(dataUrl: string, fileName: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  if (!LOGO_MIME_TYPES.has(mimeType)) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], fileName, { type: mimeType });
}

export function EnterpriseGroupSetupView({
  mode,
  initialGroup,
  onBack,
  onChanged,
}: {
  mode: SetupMode;
  initialGroup?: any;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [step, setStep] = useState<SetupStep>("identity");
  const [editDetailOpen, setEditDetailOpen] = useState(mode === "edit");
  const [activeEditTab, setActiveEditTab] = useState<EditTab>("identity");
  const [pendingModuleSelection, setPendingModuleSelection] = useState<string[] | null>(null);
  const [moduleConfirmationOpen, setModuleConfirmationOpen] = useState(false);
  const [group, setGroup] = useState<any>(initialGroup || null);
  const [loadingGroup, setLoadingGroup] = useState(Boolean(initialGroup?.id));
  const [groupForm, setGroupForm] = useState({
    name: initialGroup?.name || "",
    slug: initialGroup?.slug || "",
    description: initialGroup?.description || "",
    logo: initialGroup?.logo || "",
    enabledModules:
      Array.isArray(initialGroup?.enabledModules) &&
      initialGroup.enabledModules.length
        ? initialGroup.enabledModules
        : [...DEFAULT_ENTERPRISE_MODULES],
  });
  const [managerForm, setManagerForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [managerEmailStatus, setManagerEmailStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [draftManager, setDraftManager] = useState<any>(null);
  const [unitForm, setUnitForm] = useState({
    name: "",
    slug: "",
    description: "",
    enabledModules: [...DEFAULT_ENTERPRISE_MODULES],
  });
  const [warehouseForm, setWarehouseForm] = useState({
    name: "",
    location: "",
    businessUnitId: "",
    authorizedBranchIds: [] as string[],
  });
  const [branchForm, setBranchForm] = useState({
    name: "",
    slug: "",
    logo: "",
    industry: "OTHER",
    subIndustry: "OTHER",
    businessType: "",
    businessUnitId: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    moduleMode: "INHERIT" as "INHERIT" | "CUSTOM",
    enabledModules: [] as string[],
  });
  const [branchAdminEmailStatus, setBranchAdminEmailStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(
    null,
  );
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const onboardingLogoScope = useRef(`onboarding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const persistLogo = async (value: string | null | undefined, folder: string, fileName: string) => {
    if (!value || !value.startsWith("data:")) return value || "";
    const file = dataUrlToFile(value, fileName);
    if (!file || file.size > LOGO_MAX_BYTES) {
      throw new Error("El logo debe ser PNG, JPG, WEBP, GIF o AVIF y no superar 2 MB");
    }
    const uploaded = await storageService.uploadFile("tenant-branding", file, {
      folder,
      scopeId: group?.id || onboardingLogoScope.current,
    });
    return uploaded.url;
  };

  const refreshGroup = async (groupId = group?.id) => {
    if (!groupId) return;
    try {
      const refreshed = await enterpriseGroupsService.getPlatformGroup(groupId);
      setGroup(refreshed);
      onChanged();
    } catch (error: any) {
      toast.error(
        error?.message || "No se pudo actualizar la información del grupo",
      );
    }
  };

  useEffect(() => {
    if (!initialGroup?.id) return;
    setLoadingGroup(true);
    enterpriseGroupsService
      .getPlatformGroup(initialGroup.id)
      .then((result) => {
        setGroup(result);
        setGroupForm((current) => ({
          ...current,
          name: result.name || current.name,
          slug: result.slug || current.slug,
          description: result.description || "",
          logo: result.logo || "",
          enabledModules:
            Array.isArray(result.enabledModules) && result.enabledModules.length
              ? result.enabledModules
              : current.enabledModules,
        }));
      })
      .catch((error: any) =>
        toast.error(error?.message || "No se pudo cargar el grupo empresarial"),
      )
      .finally(() => setLoadingGroup(false));
  }, [initialGroup?.id]);

  useEffect(() => {
    if (!group || group.__draft) return;
    setGroupForm((current) => ({
      ...current,
      name: group.name || "",
      slug: group.slug || "",
      description: group.description || "",
      logo: group.logo || "",
      enabledModules:
        Array.isArray(group.enabledModules) && group.enabledModules.length
          ? group.enabledModules
          : current.enabledModules,
    }));
  }, [group]);

  useEffect(() => {
    const email = normalizeEmail(managerForm.email);
    if (!email || !isValidEmail(email)) {
      setManagerEmailStatus("idle");
      return;
    }

    let active = true;
    setManagerEmailStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const response = await authService.checkEmail(email);
        const exists = (response as any)?.data?.exists ?? response?.exists;
        if (active) setManagerEmailStatus(exists ? "taken" : "available");
      } catch {
        if (active) setManagerEmailStatus("error");
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [managerForm.email]);

  useEffect(() => {
    const email = normalizeEmail(branchForm.adminEmail);
    if (!email || !isValidEmail(email)) {
      setBranchAdminEmailStatus("idle");
      return;
    }

    let active = true;
    setBranchAdminEmailStatus("checking");
    const timer = window.setTimeout(async () => {
      try {
        const response = await authService.checkEmail(email);
        const exists = (response as any)?.data?.exists ?? response?.exists;
        if (active) setBranchAdminEmailStatus(exists ? "taken" : "available");
      } catch {
        if (active) setBranchAdminEmailStatus("error");
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [branchForm.adminEmail]);

  const saveDraftIdentity = () => {
    const nextManager = {
      name: managerForm.name.trim(),
      email: normalizeEmail(managerForm.email),
    };
    setDraftManager(nextManager);
    setGroup((current: any) => ({
      ...(current || {}),
      id: current?.id || "draft-group",
      __draft: true,
      name: groupForm.name.trim(),
      description: groupForm.description.trim() || null,
      logo: groupForm.logo || null,
      enabledModules: groupForm.enabledModules,
      businessUnits: current?.businessUnits || [],
      warehouses: current?.warehouses || [],
      branches: current?.branches || [],
      managerAssignments: [{ user: nextManager }],
    }));
    setStep("units");
  };

  const updateGroupMutation = useMutation({
    mutationFn: async (enabledModules?: string[]) =>
      enterpriseGroupsService.updatePlatformGroup(group.id, {
        name: groupForm.name.trim(),
        slug: groupForm.slug.trim(),
        description: groupForm.description.trim() || null,
        logo: await persistLogo(groupForm.logo, "groups", "group-logo.png") || null,
        enabledModules: enabledModules ?? groupForm.enabledModules,
      }),
    onSuccess: (updated) => {
      setGroup(updated);
      onChanged();
      toast.success("Datos del grupo actualizados");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestGroupSave = () => {
    const currentModules = Array.isArray(group?.enabledModules)
      ? group.enabledModules.map((module: string) => String(module).toUpperCase())
      : [];
    const nextModules = groupForm.enabledModules.map((module: string) => String(module).toUpperCase());
    const removedModules = currentModules.filter((module: string) => !nextModules.includes(module));
    if (mode === "edit" && removedModules.length) {
      setPendingModuleSelection(nextModules);
      setModuleConfirmationOpen(true);
      return;
    }
    updateGroupMutation.mutate(nextModules);
  };

  const confirmGroupModuleChange = () => {
    updateGroupMutation.mutate(pendingModuleSelection || groupForm.enabledModules);
    setPendingModuleSelection(null);
    setModuleConfirmationOpen(false);
  };

  const managerMutation = useMutation({
    mutationFn: () =>
      enterpriseGroupsService.createPlatformManager(group.id, {
        name: managerForm.name.trim(),
        email: normalizeEmail(managerForm.email),
        password: managerForm.password,
      }),
    onSuccess: async () => {
      await refreshGroup();
      setManagerForm({ name: "", email: "", password: "" });
      toast.success("Manager creado con acceso completo al grupo");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const groupModuleIds = groupForm.enabledModules.length
    ? [...groupForm.enabledModules]
    : [...DEFAULT_ENTERPRISE_MODULES];

  const unitMutation = useMutation({
    mutationFn: () =>
      enterpriseGroupsService.createPlatformBusinessUnit(group.id, {
        name: unitForm.name.trim(),
        slug: unitForm.slug.trim(),
        description: unitForm.description.trim() || undefined,
        enabledModules: unitForm.enabledModules,
      }),
    onSuccess: async () => {
      setUnitForm({
        name: "",
        slug: "",
        description: "",
        enabledModules: groupModuleIds,
      });
      await refreshGroup();
      toast.success("Rubro agregado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ unitId, body }: { unitId: string; body: any }) =>
      enterpriseGroupsService.updatePlatformBusinessUnit(group.id, unitId, body),
    onSuccess: async () => {
      await refreshGroup();
      setEditingUnitId(null);
      toast.success("Rubro actualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const warehouseMutation = useMutation({
    mutationFn: () =>
      enterpriseGroupsService.createWarehouse(group.id, {
        name: warehouseForm.name.trim(),
        location: warehouseForm.location.trim() || undefined,
        businessUnitId: warehouseForm.businessUnitId,
        scopeType: "BUSINESS_UNIT",
        authorizedBranchIds: warehouseForm.authorizedBranchIds,
      }),
    onSuccess: async () => {
      setWarehouseForm({
        name: "",
        location: "",
        businessUnitId: "",
        authorizedBranchIds: [],
      });
      await refreshGroup();
      toast.success("Almacén agregado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateWarehouseMutation = useMutation({
    mutationFn: ({ warehouseId, body }: { warehouseId: string; body: any }) =>
      enterpriseGroupsService.updatePlatformWarehouse(group.id, warehouseId, body),
    onSuccess: async () => {
      await refreshGroup();
      setEditingWarehouseId(null);
      toast.success("Almacén actualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const units = group?.businessUnits || [];
  const warehouses = group?.warehouses || [];
  const branches = group?.branches || [];
  const manager = draftManager || group?.managerAssignments?.[0]?.user;

  const branchMutation = useMutation({
    mutationFn: () =>
      enterpriseGroupsService.createPlatformBranch(group.id, {
        name: branchForm.name.trim(),
        slug: branchForm.slug.trim(),
        logo: branchForm.logo || undefined,
        industry: branchForm.industry,
        subIndustry: branchForm.subIndustry,
        businessType: branchForm.businessType,
        businessUnitId: branchForm.businessUnitId || undefined,
        adminName: branchForm.adminName.trim(),
        adminEmail: normalizeEmail(branchForm.adminEmail),
        adminPassword: branchForm.adminPassword,
        moduleMode: branchForm.moduleMode,
        enabledModules: branchForm.enabledModules,
      }),
    onSuccess: async () => {
      setBranchForm({
        name: "",
        slug: "",
        logo: "",
        industry: "OTHER",
        subIndustry: "OTHER",
        businessType: "",
        businessUnitId: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
        moduleMode: "INHERIT",
        enabledModules: [],
      });
      await refreshGroup();
      toast.success("Sucursal agregada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateBranchMutation = useMutation({
    mutationFn: async ({ branchId, body }: { branchId: string; body: any }) =>
      enterpriseGroupsService.updatePlatformBranch(group.id, branchId, {
        ...body,
        ...(body.logo !== undefined
          ? { logo: await persistLogo(body.logo, "branches", `branch-${branchId}.png`) || null }
          : {}),
      }),
    onSuccess: async () => {
      await refreshGroup();
      setEditingBranchId(null);
      toast.success("Sucursal actualizada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isDraft = mode === "create" && Boolean(group?.__draft);
  const addDraftUnit = () => {
    const nextUnit = {
      id: `draft-unit-${Date.now()}`,
      name: unitForm.name.trim(),
      description: unitForm.description.trim() || null,
      enabledModules: unitForm.enabledModules,
      isActive: true,
      __draft: true,
    };
    setGroup((current: any) => ({
      ...current,
      businessUnits: [...(current?.businessUnits || []), nextUnit],
    }));
    setUnitForm({
      name: "",
      slug: "",
      description: "",
      enabledModules: groupModuleIds,
    });
    toast.success("Rubro agregado");
  };

  const addDraftWarehouse = () => {
    const nextWarehouse = {
      id: `draft-warehouse-${Date.now()}`,
      name: warehouseForm.name.trim(),
      location: warehouseForm.location.trim() || null,
      businessUnitId: warehouseForm.businessUnitId,
      scopeType: "BUSINESS_UNIT",
      authorizedBranchIds: warehouseForm.authorizedBranchIds,
      __draft: true,
    };
    setGroup((current: any) => ({
      ...current,
      warehouses: [...(current?.warehouses || []), nextWarehouse],
    }));
    setWarehouseForm({
      name: "",
      location: "",
      businessUnitId: units[0]?.id || "",
      authorizedBranchIds: [],
    });
    toast.success("Almacén agregado");
  };

  const addDraftBranch = () => {
    const nextBranch = {
      id: `draft-branch-${Date.now()}`,
      name: branchForm.name.trim(),
      logo: branchForm.logo || null,
      industry: branchForm.industry,
      subIndustry: branchForm.subIndustry,
      businessType: branchForm.businessType,
      businessUnitId: branchForm.businessUnitId,
      adminName: branchForm.adminName.trim(),
      adminEmail: normalizeEmail(branchForm.adminEmail),
      adminPassword: branchForm.adminPassword,
      moduleMode: branchForm.moduleMode,
      enabledModules: branchForm.enabledModules,
      _count: { users: 1, warehouses: 0 },
      __draft: true,
    };
    setGroup((current: any) => ({
      ...current,
      branches: [...(current?.branches || []), nextBranch],
    }));
    setBranchForm({
      name: "",
      slug: "",
      logo: "",
      industry: "OTHER",
      subIndustry: "OTHER",
      businessType: "",
      businessUnitId: units[0]?.id || "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
      moduleMode: "INHERIT",
      enabledModules: [],
    });
    setBranchAdminEmailStatus("idle");
    toast.success("Sucursal agregada");
  };

  const startDraftUnitEdit = (unit: any) => {
    setEditingUnitId(unit.id);
    setUnitForm({
      name: unit.name || "",
      slug: unit.slug || "",
      description: unit.description || "",
      enabledModules:
        Array.isArray(unit.enabledModules) && unit.enabledModules.length
          ? unit.enabledModules
          : [...DEFAULT_ENTERPRISE_MODULES],
    });
  };

  const saveDraftUnitEdit = () => {
    if (!editingUnitId) return;
    setGroup((current: any) => ({
      ...current,
      businessUnits: (current?.businessUnits || []).map((unit: any) =>
        unit.id === editingUnitId
          ? {
              ...unit,
              name: unitForm.name.trim(),
              description: unitForm.description.trim() || null,
              enabledModules: unitForm.enabledModules,
            }
          : unit,
      ),
    }));
    setEditingUnitId(null);
    setUnitForm({
      name: "",
      slug: "",
      description: "",
      enabledModules: groupModuleIds,
    });
    toast.success("Rubro actualizado");
  };

  const savePersistentUnitEdit = () => {
    if (!editingUnitId) return;
    updateUnitMutation.mutate({
      unitId: editingUnitId,
      body: {
        name: unitForm.name.trim(),
        slug: unitForm.slug.trim() || unitForm.name.trim(),
        description: unitForm.description.trim() || null,
        enabledModules: unitForm.enabledModules,
      },
    });
  };

  const removeDraftUnit = (unitId: string) => {
    if (
      warehouses.some(
        (warehouse: any) => warehouse.businessUnitId === unitId,
      ) ||
      branches.some((branch: any) => branch.businessUnitId === unitId)
    ) {
      toast.error("Primero elimina o reasigna los elementos de este rubro");
      return;
    }
    setGroup((current: any) => ({
      ...current,
      businessUnits: (current?.businessUnits || []).filter(
        (unit: any) => unit.id !== unitId,
      ),
    }));
    if (editingUnitId === unitId) setEditingUnitId(null);
    toast.success("Rubro eliminado");
  };

  const startDraftWarehouseEdit = (warehouse: any) => {
    setEditingWarehouseId(warehouse.id);
    setWarehouseForm({
      name: warehouse.name || "",
      location: warehouse.location || "",
      businessUnitId: warehouse.businessUnitId || "",
      authorizedBranchIds: Array.isArray(warehouse.authorizedBranchIds)
        ? warehouse.authorizedBranchIds
        : [],
    });
  };

  const saveDraftWarehouseEdit = () => {
    if (!editingWarehouseId) return;
    setGroup((current: any) => ({
      ...current,
      warehouses: (current?.warehouses || []).map((warehouse: any) =>
        warehouse.id === editingWarehouseId
          ? {
              ...warehouse,
              name: warehouseForm.name.trim(),
              location: warehouseForm.location.trim() || null,
              businessUnitId: warehouseForm.businessUnitId,
              authorizedBranchIds: warehouseForm.authorizedBranchIds,
            }
          : warehouse,
      ),
    }));
    setEditingWarehouseId(null);
    setWarehouseForm({
      name: "",
      location: "",
      businessUnitId: units[0]?.id || "",
      authorizedBranchIds: [],
    });
    toast.success("Almacén actualizado");
  };

  const savePersistentWarehouseEdit = () => {
    if (!editingWarehouseId) return;
    updateWarehouseMutation.mutate({
      warehouseId: editingWarehouseId,
      body: {
        name: warehouseForm.name.trim(),
        location: warehouseForm.location.trim() || null,
        businessUnitId: warehouseForm.businessUnitId,
        authorizedBranchIds: warehouseForm.authorizedBranchIds,
      },
    });
  };

  const removeDraftWarehouse = (warehouseId: string) => {
    setGroup((current: any) => ({
      ...current,
      warehouses: (current?.warehouses || []).filter(
        (warehouse: any) => warehouse.id !== warehouseId,
      ),
    }));
    if (editingWarehouseId === warehouseId) setEditingWarehouseId(null);
    toast.success("Almacén eliminado");
  };

  const startDraftBranchEdit = (branch: any) => {
    setEditingBranchId(branch.id);
    setBranchForm({
      name: branch.name || "",
      slug: branch.slug || "",
      logo: branch.logo || "",
      industry: branch.industry || "OTHER",
      subIndustry: branch.subIndustry || "OTHER",
      businessType: branch.businessType || "OTHER",
      businessUnitId: branch.businessUnitId || "",
      adminName: branch.adminName || "",
      adminEmail: branch.adminEmail || "",
      adminPassword: branch.adminPassword || "",
      moduleMode: branch.moduleMode || "INHERIT",
      enabledModules: Array.isArray(branch.enabledModules)
        ? branch.enabledModules
        : [],
    });
    setBranchAdminEmailStatus("idle");
  };

  const saveDraftBranchEdit = () => {
    if (!editingBranchId) return;
    setGroup((current: any) => ({
      ...current,
      branches: (current?.branches || []).map((branch: any) =>
        branch.id === editingBranchId
          ? {
              ...branch,
              name: branchForm.name.trim(),
              logo: branchForm.logo || null,
              industry: branchForm.industry,
              subIndustry: branchForm.subIndustry,
              businessType: branchForm.businessType,
              businessUnitId: branchForm.businessUnitId,
              adminName: branchForm.adminName.trim(),
              adminEmail: normalizeEmail(branchForm.adminEmail),
              adminPassword: branchForm.adminPassword,
              moduleMode: branchForm.moduleMode,
              enabledModules: branchForm.enabledModules,
            }
          : branch,
      ),
    }));
    setEditingBranchId(null);
    setBranchForm({
      name: "",
      slug: "",
      logo: "",
      industry: "OTHER",
      subIndustry: "OTHER",
      businessType: "",
      businessUnitId: units[0]?.id || "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
      moduleMode: "INHERIT",
      enabledModules: [],
    });
    setBranchAdminEmailStatus("idle");
    toast.success("Sucursal actualizada");
  };

  const savePersistentBranchEdit = () => {
    if (!editingBranchId) return;
    updateBranchMutation.mutate({
      branchId: editingBranchId,
      body: {
        name: branchForm.name.trim(),
        slug: branchForm.slug.trim() || branchForm.name.trim(),
        logo: branchForm.logo || null,
        industry: branchForm.industry,
        subIndustry: branchForm.subIndustry,
        businessType: branchForm.businessType,
        businessUnitId: branchForm.businessUnitId || undefined,
        moduleMode: branchForm.moduleMode,
        enabledModules: branchForm.enabledModules,
      },
    });
  };

  const updateUnitStatus = (unit: any) =>
    updateUnitMutation.mutate({
      unitId: unit.id,
      body: { isActive: unit.isActive === false },
    });

  const updateWarehouseStatus = (warehouse: any) =>
    updateWarehouseMutation.mutate({
      warehouseId: warehouse.id,
      body: { isActive: warehouse.isActive === false },
    });

  const updateBranchStatus = (branch: any) =>
    updateBranchMutation.mutate({
      branchId: branch.id,
      body: { isActive: branch.isActive === false },
    });

  const removeDraftBranch = (branchId: string) => {
    setGroup((current: any) => ({
      ...current,
      branches: (current?.branches || []).filter(
        (branch: any) => branch.id !== branchId,
      ),
      warehouses: (current?.warehouses || []).map((warehouse: any) => ({
        ...warehouse,
        authorizedBranchIds: (warehouse.authorizedBranchIds || []).filter(
          (id: string) => id !== branchId,
        ),
      })),
    }));
    if (editingBranchId === branchId) setEditingBranchId(null);
    toast.success("Sucursal eliminada");
  };

  const commitOnboardingMutation = useMutation({
    mutationFn: async () => {
      const groupLogo = await persistLogo(groupForm.logo, "groups", "group-logo.png");
      const persistedBranches = await Promise.all(
        branches.map(async (branch: any, index: number) => ({
          ...branch,
          logo: await persistLogo(branch.logo, "branches", `branch-${index + 1}.png`),
        })),
      );

      return enterpriseGroupsService.commitPlatformOnboarding({
        group: {
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || undefined,
          logo: groupLogo || undefined,
          enabledModules: groupForm.enabledModules,
        },
        manager: {
          name: managerForm.name.trim(),
          email: normalizeEmail(managerForm.email),
          password: managerForm.password,
        },
        businessUnits: units.map((unit: any) => ({
          name: unit.name,
          description: unit.description || undefined,
          enabledModules: unit.enabledModules || DEFAULT_ENTERPRISE_MODULES,
        })),
        warehouses: warehouses.map((warehouse: any) => ({
          name: warehouse.name,
          location: warehouse.location || undefined,
          businessUnitIndex: units.findIndex(
            (unit: any) => unit.id === warehouse.businessUnitId,
          ),
          authorizedBranchIndexes: (warehouse.authorizedBranchIds || [])
            .map((branchId: string) =>
              branches.findIndex((branch: any) => branch.id === branchId),
            )
            .filter((index: number) => index >= 0),
        })),
        branches: persistedBranches.map((branch: any) => ({
          name: branch.name,
          logo: branch.logo || undefined,
          industry: branch.industry,
          subIndustry: branch.subIndustry,
          businessType: branch.businessType,
          businessUnitIndex: units.findIndex(
            (unit: any) => unit.id === branch.businessUnitId,
          ),
          adminName: branch.adminName,
          adminEmail: branch.adminEmail,
          adminPassword: branch.adminPassword,
          enabledModules:
            branch.moduleMode === "CUSTOM" ? branch.enabledModules : undefined,
        })),
      });
    },
    onSuccess: () => {
      onChanged();
      toast.success("Grupo empresarial configurado correctamente");
      onBack();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    const firstUnitId = units[0]?.id;
    if (!firstUnitId) return;
    if (!warehouseForm.businessUnitId)
      setWarehouseForm((current) => ({
        ...current,
        businessUnitId: firstUnitId,
      }));
    if (!branchForm.businessUnitId)
      setBranchForm((current) => ({ ...current, businessUnitId: firstUnitId }));
    const selectedUnit = units.find(
      (unit: any) => unit.id === (branchForm.businessUnitId || firstUnitId),
    );
    if (selectedUnit && !branchForm.businessType) {
      setBranchForm((current) => ({
        ...current,
        businessType: selectedUnit.name,
        subIndustry: selectedUnit.name,
      }));
    }
  }, [
    units,
    warehouseForm.businessUnitId,
    branchForm.businessUnitId,
    branchForm.businessType,
  ]);
  const canCreateGroup = Boolean(
    groupForm.name.trim() &&
    groupForm.enabledModules.length > 0 &&
    managerForm.name.trim() &&
    isValidEmail(managerForm.email) &&
    managerEmailStatus === "available" &&
    !getPasswordError(managerForm.password),
  );
  const canCreateBranch = editingBranchId
    ? Boolean(
        units.length > 0 &&
          branchForm.businessUnitId &&
          branchForm.name.trim(),
      )
    : Boolean(
        units.length > 0 &&
          branchForm.businessUnitId &&
          branchForm.name.trim() &&
          branchForm.adminName.trim() &&
          isValidEmail(branchForm.adminEmail) &&
          branchAdminEmailStatus === "available" &&
          normalizeEmail(branchForm.adminEmail) !==
            normalizeEmail(managerForm.email) &&
          !branches.some(
            (branch: any) =>
              branch.id !== editingBranchId &&
              normalizeEmail(branch.adminEmail) ===
                normalizeEmail(branchForm.adminEmail),
          ) &&
          !getPasswordError(branchForm.adminPassword),
      );
  const progress = useMemo(() => {
    if (!group) return 0;
    const configured = [
      Boolean(group),
      units.length > 0,
      warehouses.length > 0,
      branches.length > 0,
      true,
    ].filter(Boolean).length;
    return Math.round((configured / 5) * 100);
  }, [group, units.length, warehouses.length, branches.length]);

  const goTo = (next: SetupStep) => {
    if (next !== "identity" && !group) {
      toast.info("Primero guarda el grupo y su Manager inicial");
      return;
    }
    setStep(next);
  };

  const finishSetup = () => {
    if (mode === "create") {
      commitOnboardingMutation.mutate();
      return;
    }
    toast.success("Configuración del grupo revisada correctamente");
    onBack();
  };

  if (loadingGroup) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Cargando configuración
        del grupo…
      </div>
    );
  }

  if (mode === "edit" && group && !editDetailOpen) {
    return (
      <GroupConfigurationView
        group={group}
        groupForm={groupForm}
        setGroupForm={setGroupForm}
        units={units}
        branches={branches}
        warehouses={warehouses}
        manager={manager}
        updating={updateGroupMutation.isPending}
        onSave={requestGroupSave}
        onUpdateUnit={(unitId: string, enabledModules: string[]) => updateUnitMutation.mutate({ unitId, body: { enabledModules } })}
        updatingUnitId={updateUnitMutation.isPending ? String(updateUnitMutation.variables?.unitId || '') : ''}
        onBack={onBack}
        activeTab={activeEditTab}
        moduleConfirmationOpen={moduleConfirmationOpen}
        onModuleConfirmationChange={setModuleConfirmationOpen}
        onConfirmModuleChange={confirmGroupModuleChange}
        onTabChange={(tab: EditTab) => {
          setActiveEditTab(tab);
          if (tab === "overview") {
            setEditDetailOpen(false);
            return;
          }
          setEditDetailOpen(true);
          setStep(tab === "managers" || tab === "users" ? "identity" : tab);
        }}
        onChanged={refreshGroup}
        onOpenDetail={(next: SetupStep) => {
          setStep(next);
          setEditDetailOpen(true);
          setActiveEditTab(next === "summary" ? "overview" : next);
        }}
      />
    );
  }

  return (
    <div className="enterprise-group-setup min-w-0 max-w-full overflow-x-hidden bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] min-w-0 p-4 sm:p-6 md:p-10">
        <div className="mb-8 flex min-w-0 flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="outline"
              size="icon"
              className="mt-1 size-10 shrink-0 rounded-xl"
              onClick={onBack}
              aria-label="Volver a grupos empresariales"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                Configuración avanzada ·{" "}
                {mode === "create" ? "Nuevo grupo" : "Grupo empresarial"}
              </p>
              <h1 className="truncate text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">
                {group?.name || "Crear grupo empresarial"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Define la jerarquía antes de operar: grupo → rubro → almacén
                corporativo → sucursal → bodegas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-4 py-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Configuración
              </p>
              <p className="text-lg font-black">{progress}%</p>
            </div>
          </div>
        </div>

        {mode === "edit" && (
          <GroupEditTabs
            active={activeEditTab}
            onChange={(tab) => {
              setActiveEditTab(tab);
              if (tab === "overview") {
                setEditDetailOpen(false);
                return;
              }
              setEditDetailOpen(true);
              setStep(tab === "managers" || tab === "users" ? "identity" : tab);
            }}
          />
        )}

        <div className={`grid min-w-0 gap-6 ${mode === "create" ? "lg:grid-cols-[270px_minmax(0,1fr)]" : "grid-cols-1"}`}>
          {mode === "create" && <aside className="min-w-0">
            <Card className="rounded-3xl border-border/60 bg-card/50 lg:sticky lg:top-6">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                  Pasos del grupo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3 pt-0">
                {steps.map((item, index) => {
                  const Icon = item.icon;
                  const active = step === item.id;
                  const locked = item.id !== "identity" && !group;
                  return (
                    <button
                      key={item.id}
                      disabled={locked}
                      onClick={() => goTo(item.id)}
                      className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${active ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15" : locked ? "cursor-not-allowed opacity-40" : "hover:bg-muted/60"}`}
                    >
                      <span
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl ${active ? "bg-primary-foreground/15" : "bg-muted/50 text-primary"}`}
                      >
                        {active ? (
                          <Icon className="size-4" />
                        ) : index < 1 && group ? (
                          <Check className="size-4" />
                        ) : (
                          <Icon className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black">
                          {item.label}
                        </span>
                        <span
                          className={`mt-0.5 block text-[11px] ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          {item.caption}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
            <Card className="mt-4 hidden rounded-3xl border-primary/20 bg-primary/[0.03] lg:block">
              <CardContent className="space-y-3 p-5 text-xs text-muted-foreground">
                <p className="flex items-center gap-2 font-black uppercase tracking-widest text-primary">
                  <KeyRound className="size-4" /> Regla de acceso
                </p>
                <p className="leading-relaxed">
                  El Manager pertenece al grupo, no a una sucursal. Desde su
                  panel puede consolidar y entrar a una sucursal cuando tenga
                  que operar allí.
                </p>
              </CardContent>
            </Card>
          </aside>}

          <main className="min-w-0 space-y-6">
            {mode === "edit" && activeEditTab === "managers" ? (
              <ManagersEditStep group={group} onChanged={refreshGroup} />
            ) : mode === "edit" && activeEditTab === "users" ? (
              <UsersEditStep group={group} onChanged={refreshGroup} />
            ) : step === "identity" && (
              <IdentityStep
                mode={mode}
                editMode={mode === "edit"}
                draft={isDraft}
                group={group}
                groupForm={groupForm}
                setGroupForm={setGroupForm}
                manager={mode === "create" ? null : manager}
                managerForm={managerForm}
                setManagerForm={setManagerForm}
                managerEmailStatus={managerEmailStatus}
                canCreateGroup={canCreateGroup}
                creating={false}
                creatingManager={managerMutation.isPending}
                updating={updateGroupMutation.isPending}
                onCreate={saveDraftIdentity}
                onCreateManager={() => managerMutation.mutate()}
                onUpdate={requestGroupSave}
                onNext={() => setStep("units")}
              />
            )}
            {step === "units" && (
              <UnitsStep
                units={units}
                editMode={mode === "edit"}
                unitForm={unitForm}
                setUnitForm={setUnitForm}
                availableModules={groupModuleIds}
                creating={isDraft ? false : unitMutation.isPending || updateUnitMutation.isPending}
                editingId={editingUnitId}
                onCreate={
                  isDraft
                    ? editingUnitId
                      ? saveDraftUnitEdit
                      : addDraftUnit
                    : editingUnitId
                      ? savePersistentUnitEdit
                      : () => unitMutation.mutate()
                }
                onEdit={startDraftUnitEdit}
                onDelete={isDraft ? removeDraftUnit : undefined}
                onStatusChange={isDraft ? undefined : updateUnitStatus}
                onCancelEdit={() => {
                  setEditingUnitId(null);
                  setUnitForm({
                    name: "",
                    slug: "",
                    description: "",
                    enabledModules: groupModuleIds,
                  });
                }}
                onNext={() => setStep("branches")}
              />
            )}
            {step === "branches" && (
              <BranchesStep
                units={units}
                branches={branches}
                editMode={mode === "edit"}
                availableModules={groupModuleIds}
                form={branchForm}
                setForm={setBranchForm}
                creating={isDraft ? false : branchMutation.isPending || updateBranchMutation.isPending}
                editingId={editingBranchId}
                canCreate={canCreateBranch}
                emailStatus={branchAdminEmailStatus}
                onCreate={
                  isDraft
                    ? editingBranchId
                      ? saveDraftBranchEdit
                      : addDraftBranch
                    : editingBranchId
                      ? savePersistentBranchEdit
                      : () => branchMutation.mutate()
                }
                onEdit={startDraftBranchEdit}
                onDelete={isDraft ? removeDraftBranch : undefined}
                onStatusChange={isDraft ? undefined : updateBranchStatus}
                onCancelEdit={() => {
                  setEditingBranchId(null);
                  setBranchForm({
                    name: "",
                    slug: "",
                    logo: "",
                    industry: "OTHER",
                    subIndustry: "OTHER",
                    businessType: "",
                    businessUnitId: units[0]?.id || "",
                    adminName: "",
                    adminEmail: "",
                    adminPassword: "",
                    moduleMode: "INHERIT",
                    enabledModules: [],
                  });
                }}
                onNext={() => setStep("warehouses")}
              />
            )}
            {step === "warehouses" && (
              <WarehousesStep
                units={units}
                branches={branches}
                warehouses={warehouses}
                editMode={mode === "edit"}
                form={warehouseForm}
                setForm={setWarehouseForm}
                creating={isDraft ? false : warehouseMutation.isPending || updateWarehouseMutation.isPending}
                editingId={editingWarehouseId}
                onCreate={
                  isDraft
                    ? editingWarehouseId
                      ? saveDraftWarehouseEdit
                      : addDraftWarehouse
                    : editingWarehouseId
                      ? savePersistentWarehouseEdit
                      : () => warehouseMutation.mutate()
                }
                onEdit={startDraftWarehouseEdit}
                onDelete={isDraft ? removeDraftWarehouse : undefined}
                onStatusChange={isDraft ? undefined : updateWarehouseStatus}
                onCancelEdit={() => {
                  setEditingWarehouseId(null);
                  setWarehouseForm({
                    name: "",
                    location: "",
                    businessUnitId: units[0]?.id || "",
                    authorizedBranchIds: [],
                  });
                }}
                onNext={() => setStep("summary")}
              />
            )}
            {step === "summary" && (
              <SummaryStep
                group={group}
                manager={manager}
                units={units}
                warehouses={warehouses}
                branches={branches}
                onGoTo={goTo}
                onFinish={finishSetup}
                finishing={commitOnboardingMutation.isPending}
                draft={isDraft}
              />
            )}
          </main>
        </div>
        <ConfirmDialog
          open={moduleConfirmationOpen}
          onOpenChange={setModuleConfirmationOpen}
          title="¿Desactivar módulos del grupo?"
          description="Las sucursales dejarán de ver y utilizar temporalmente estos módulos. Los registros, roles y configuraciones se conservarán y volverán a estar disponibles al reactivarlos."
          confirmLabel="Desactivar temporalmente"
          cancelLabel="Mantener activos"
          variant="warning"
          onConfirm={confirmGroupModuleChange}
          loading={updateGroupMutation.isPending}
        />
      </div>
    </div>
  );
}

function GroupEditTabs({
  active,
  onChange,
}: {
  active: EditTab;
  onChange: (tab: EditTab) => void;
}) {
  const tabs: Array<{ id: EditTab; label: string; icon: typeof Building2 }> = [
    { id: "identity", label: "Identidad y módulos", icon: ShieldCheck },
    { id: "managers", label: "Manager", icon: UserCog },
    { id: "users", label: "Usuarios de sucursal", icon: Users },
    { id: "units", label: "Rubros", icon: GitBranch },
    { id: "warehouses", label: "Almacenes", icon: Warehouse },
    { id: "branches", label: "Sucursales", icon: Building2 },
  ];

  return (
    <div className="mb-6 flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card/60 p-2 md:mb-8">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={active === id ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wide transition ${active === id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function ManagersEditStep({
  group,
  onChanged,
}: {
  group: any;
  onChanged: () => void | Promise<void>;
}) {
  const managers = group?.managerAssignments || [];
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const savePassword = async () => {
    const passwordError = getPasswordError(password);
    if (!selectedManager?.user?.id || passwordError) {
      toast.error(passwordError || "Selecciona un Manager");
      return;
    }
    try {
      setSaving(true);
      await enterpriseGroupsService.updatePlatformManagerPassword(
        group.id,
        selectedManager.user.id,
        password,
      );
      toast.success("Contraseña del Manager actualizada");
      setSelectedManager(null);
      setPassword("");
      await onChanged();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo actualizar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionIntro
        icon={UserCog}
        minimal
        eyebrow="Configuración del grupo"
        title="Managers del grupo"
        description="Administra los accesos globales del grupo sin mezclarlos con los usuarios operativos de las sucursales. Los permisos y la contraseña se pueden gestionar desde soporte de plataforma."
      />
      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
            <Users className="size-5 text-primary" /> Accesos Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {managers.map((assignment: any) => (
            <div key={assignment.id} className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">{assignment.user?.name || "Manager sin nombre"}</p>
                <p className="text-sm text-muted-foreground">{assignment.user?.email || "Sin correo"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {assignment.isOwner ? "Propietario del grupo" : "Manager delegado"} · {assignment.user?.isActive === false ? "Inactivo" : "Activo"}
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 rounded-xl"
                onClick={() => {
                  setSelectedManager(assignment);
                  setPassword("");
                }}
              >
                <KeyRound className="mr-2 size-4" /> Cambiar contraseña
              </Button>
            </div>
          ))}
          {!managers.length && (
            <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">Este grupo no tiene un Manager asignado</p>
                <p className="mt-1 text-sm text-muted-foreground">Puedes crear el acceso global desde el botón de soporte.</p>
              </div>
              <GroupManagerSupportDialog group={group} onChanged={onChanged} />
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(selectedManager)}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setSelectedManager(null);
            setPassword("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl p-5 sm:p-7">
          <DialogHeader>
            <DialogTitle className="font-black uppercase italic tracking-tight">
              Cambiar contraseña del Manager
            </DialogTitle>
            <DialogDescription>
              Actualiza la contraseña de {selectedManager?.user?.name || "este Manager"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className={labelClass}>
              Nueva contraseña
              <input
                autoFocus
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contraseña segura"
                className={inputClass}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              {getPasswordError(password) || "Debe cumplir la política de seguridad de NovaHub."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={saving}
              onClick={() => setSelectedManager(null)}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-xl"
              disabled={saving || Boolean(getPasswordError(password))}
              onClick={savePassword}
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Guardar contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsersEditStep({
  group,
  onChanged,
}: {
  group: any;
  onChanged: () => void | Promise<void>;
}) {
  const branches = group?.branches || [];
  return (
    <div className="space-y-6">
      <SectionIntro
        icon={Users}
        minimal
        eyebrow="Configuración del grupo"
        title="Usuarios de las sucursales"
        description="Los usuarios operativos siguen perteneciendo a cada sucursal. Desde aquí puedes abrir el soporte de una sucursal para consultar usuarios, cambiar contraseñas o inhabilitar cuentas sin borrar sus registros."
      />
      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
            <Building2 className="size-5 text-primary" /> Sucursales y usuarios
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-6 md:grid-cols-2">
          {branches.map((branch: any) => (
            <div key={branch.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
              <div className="min-w-0">
                <p className="truncate font-black">{branch.name}</p>
                <p className="text-xs text-muted-foreground">
                  {branch._count?.users ?? 0} usuarios · {branch.isActive === false ? "Sucursal inactiva" : "Sucursal activa"}
                </p>
              </div>
              <GroupBranchSupportDialog branch={branch} onChanged={onChanged} />
            </div>
          ))}
          {!branches.length && (
            <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground md:col-span-2">
              Todavía no hay sucursales en este grupo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GroupConfigurationView({
  group,
  groupForm,
  setGroupForm,
  units,
  branches,
  warehouses,
  manager,
  updating,
  onSave,
  onUpdateUnit,
  updatingUnitId,
  onBack,
  onOpenDetail,
  activeTab,
  onTabChange,
  moduleConfirmationOpen,
  onModuleConfirmationChange,
  onConfirmModuleChange,
}: any) {
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitModuleDrafts, setUnitModuleDrafts] = useState<Record<string, string[]>>({});
  const startUnitEdit = (unit: any) => {
    setEditingUnitId(unit.id);
    setUnitModuleDrafts((current) => ({ ...current, [unit.id]: Array.isArray(unit.enabledModules) ? [...unit.enabledModules] : [] }));
  };
  return (
    <div className="enterprise-group-configuration min-w-0 max-w-full overflow-x-hidden bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] min-w-0 space-y-6 p-4 sm:p-6 md:p-10">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Button
              variant="outline"
              size="icon"
              className="mt-1 size-10 shrink-0 rounded-xl"
              onClick={onBack}
              aria-label="Volver a grupos empresariales"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                Configuración del grupo
              </p>
              <h1 className="truncate text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">
                {group.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Administra la identidad, los módulos heredables y la estructura
                operativa sin repetir el flujo de implementación inicial.
              </p>
            </div>
          </div>
          <Badge className="w-fit shrink-0 rounded-xl px-3 py-2">
            <ShieldCheck className="mr-2 size-4" /> Superadmin · acceso global
          </Badge>
        </div>
        <GroupEditTabs active={activeTab} onChange={onTabChange} />
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <Card className="rounded-3xl border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
                <Building2 className="size-5 text-primary" /> Identidad del
                grupo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-6 lg:grid-cols-[160px_minmax(0,1fr)]">
              <LogoPicker
                value={groupForm.logo}
                onChange={(logo) =>
                  setGroupForm((current: any) => ({ ...current, logo }))
                }
              />
              <div className="grid gap-4">
                <label className={labelClass}>
                  Nombre del grupo
                  <input
                    value={groupForm.name}
                    onChange={(event) =>
                      setGroupForm((current: any) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className={labelClass}>
                  Descripción
                  <textarea
                    value={groupForm.description}
                    onChange={(event) =>
                      setGroupForm((current: any) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
                <Button
                  className="w-fit rounded-xl"
                  onClick={onSave}
                  disabled={updating || !groupForm.enabledModules.length}
                >
                  {updating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 size-4" />
                  )}
                  Guardar configuración
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-primary/20 bg-primary/[0.03]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
                <ShieldCheck className="size-5 text-primary" /> Alcance de
                módulos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ModuleSelector
                value={groupForm.enabledModules}
                onChange={(enabledModules) =>
                  setGroupForm((current: any) => ({
                    ...current,
                    enabledModules,
                  }))
                }
              />
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Los rubros y sucursales no podrán seleccionar módulos fuera de
                este conjunto. Al reducirlo se restringe el acceso de forma
                reversible; no se eliminan datos, registros ni permisos guardados.
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid min-w-0 gap-6 lg:grid-cols-3">
          <StructureCard
            icon={GitBranch}
            title="Rubros"
            count={units.length}
            description="Cada rubro define los módulos heredables y el giro válido de sus sucursales."
            items={units.map((unit: any) => ({
              title: unit.name,
              detail: `${Array.isArray(unit.enabledModules) ? unit.enabledModules.length : 0} módulos habilitados`,
              badge: unit.isActive === false ? "Inactivo" : "Activo",
            }))}
            onOpen={() => onOpenDetail("units")}
          />
          <StructureCard
            icon={Building2}
            title="Sucursales"
            count={branches.length}
            description="Cada sucursal conserva su operación, bodegas, usuarios y roles propios."
            items={branches.map((branch: any) => ({
              title: branch.name,
              detail:
                branch.businessType ||
                units.find((unit: any) => unit.id === branch.businessUnitId)
                  ?.name ||
                "Giro pendiente",
              badge: branch.isActive === false ? "Inactiva" : "Activa",
            }))}
            onOpen={() => onOpenDetail("branches")}
          />
          <StructureCard
            icon={Warehouse}
            title="Almacenes corporativos"
            count={warehouses.length}
            description="Se mantienen fuera de las sucursales y abastecen según las autorizaciones del rubro."
            items={warehouses.map((warehouse: any) => ({
              title: warehouse.name,
              detail:
                units.find((unit: any) => unit.id === warehouse.businessUnitId)
                  ?.name || "Rubro pendiente",
              badge: warehouse.isActive === false
                ? "Inactivo"
                : warehouse.location || "Sin ubicación",
            }))}
            onOpen={() => onOpenDetail("warehouses")}
          />
        </div>
        <Card className="rounded-3xl border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
              <GitBranch className="size-5 text-primary" /> Módulos por rubro
            </CardTitle>
            <p className="text-sm text-muted-foreground">Activa o desactiva módulos sin volver a ejecutar la implementación inicial. El rubro nunca puede superar los módulos autorizados por el grupo.</p>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {units.map((unit: any) => {
              const editing = editingUnitId === unit.id;
              const modules = unitModuleDrafts[unit.id] || (Array.isArray(unit.enabledModules) ? unit.enabledModules : []);
              return <div key={unit.id} className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="font-black">{unit.name}</p><p className="text-xs text-muted-foreground">{modules.length} módulos activos · las sucursales pueden heredar esta selección</p></div>
                  <Button type="button" variant={editing ? 'secondary' : 'outline'} className="w-fit shrink-0 rounded-xl" onClick={() => editing ? setEditingUnitId(null) : startUnitEdit(unit)}>{editing ? 'Cerrar edición' : 'Editar módulos'}</Button>
                </div>
                {editing && <div className="mt-4 space-y-3"><ModuleSelector value={modules} availableModules={groupForm.enabledModules} onChange={(enabledModules) => setUnitModuleDrafts((current) => ({ ...current, [unit.id]: enabledModules }))} /><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Incluye “Restaurante POS” para habilitar la facturación rápida de caja en este rubro.</p><Button type="button" className="rounded-xl" disabled={updatingUnitId === unit.id} onClick={() => onUpdateUnit(unit.id, modules)}>{updatingUnitId === unit.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Guardar rubro</Button></div></div>}
              </div>;
            })}
            {!units.length && <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Crea primero un rubro para configurar sus módulos.</p>}
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/60 bg-card/50">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">
                Manager propietario
              </p>
              <p className="mt-1 font-black">
                {manager?.name || "Sin Manager asignado"}
              </p>
              <p className="text-sm text-muted-foreground">
                {manager?.email ||
                  "El acceso se puede configurar desde Accesos Manager."}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-fit rounded-xl"
              onClick={() => onOpenDetail("identity")}
            >
              Revisar acceso y estructura
            </Button>
          </CardContent>
        </Card>
        <ConfirmDialog
          open={moduleConfirmationOpen}
          onOpenChange={onModuleConfirmationChange}
          title="¿Desactivar módulos del grupo?"
          description="Las sucursales dejarán de ver y utilizar temporalmente estos módulos. Los registros, roles y configuraciones se conservarán y volverán a estar disponibles al reactivarlos."
          confirmLabel="Desactivar temporalmente"
          cancelLabel="Mantener activos"
          variant="warning"
          onConfirm={onConfirmModuleChange}
          loading={updating}
        />
      </div>
    </div>
  );
}

function StructureCard({
  icon: Icon,
  title,
  count,
  description,
  items,
  onOpen,
}: {
  icon: typeof Building2;
  title: string;
  count: number;
  description: string;
  items: Array<{ title: string; detail: string; badge: string }>;
  onOpen: () => void;
}) {
  return (
    <Card className="rounded-3xl border-border/60">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
              <Icon className="size-5 text-primary" /> {title}
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          <span className="rounded-xl bg-primary/10 px-3 py-2 text-lg font-black text-primary">
            {count}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-6 pt-0">
        {items.slice(0, 4).map((item) => (
          <div
            key={`${item.title}-${item.detail}`}
            className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/15 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.detail}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              {item.badge}
            </Badge>
          </div>
        ))}
        {!items.length && (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Todavía no hay registros.
          </p>
        )}
        <Button
          variant="outline"
          className="mt-2 w-full rounded-xl"
          onClick={onOpen}
        >
          Administrar {title.toLowerCase()}
        </Button>
      </CardContent>
    </Card>
  );
}

function LogoPicker({
  value,
  onChange,
  label = "Logo del grupo",
  alt = "Logo del grupo empresarial",
  helpText = "Se mostrará en el Navigator Manager.",
}: {
  value?: string | null;
  onChange: (value: string) => void;
  label?: string;
  alt?: string;
  helpText?: string;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const inferredMime = extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : extension === "gif"
            ? "image/gif"
            : extension === "avif"
              ? "image/avif"
              : file.type;
    if (!LOGO_MIME_TYPES.has(inferredMime)) {
      toast.error("Usa un logo PNG, JPG, WEBP, GIF o AVIF");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error("El logo no debe superar 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ""));
    const normalizedFile = file.type === inferredMime
      ? file
      : new File([file], file.name, { type: inferredMime });
    reader.readAsDataURL(normalizedFile);
    event.currentTarget.value = "";
  };

  return (
    <div className="space-y-2">
      <p className={labelClass}>{label}</p>
      <label className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-primary/40 bg-primary/[0.04] text-center transition hover:border-primary hover:bg-primary/[0.08]">
        {value ? (
          <img
            src={value}
            alt={alt}
            className="size-full object-contain p-4"
          />
        ) : (
          <>
            <ImagePlus className="size-8 text-primary" />
            <span className="mt-2 px-3 text-xs font-bold text-muted-foreground">
              Subir logo
            </span>
          </>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={handleChange}
        />
      </label>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {helpText}
      </p>
    </div>
  );
}

function IdentityStep({
  mode,
  editMode,
  draft,
  group,
  groupForm,
  setGroupForm,
  manager,
  managerForm,
  setManagerForm,
  managerEmailStatus,
  canCreateGroup,
  creating,
  creatingManager,
  updating,
  onCreate,
  onCreateManager,
  onUpdate,
  onNext,
}: any) {
  return (
    <div className="space-y-6">
      <SectionIntro
        icon={ShieldCheck}
        minimal={editMode}
        eyebrow="Paso 1"
        title="Identidad y acceso Manager"
        description="Prepara el grupo, su identidad visual y el primer usuario Manager global. El Superadmin conserva acceso global a todos los grupos."
      />
      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
            <Building2 className="size-5 text-primary" /> Datos del grupo
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 p-6 lg:grid-cols-[180px_minmax(0,1fr)]">
          <LogoPicker
            value={groupForm.logo}
            onChange={(logo) =>
              setGroupForm((current: any) => ({ ...current, logo }))
            }
          />
          <div className="grid gap-4">
            <label className={labelClass}>
              Nombre del grupo
              <input
                value={groupForm.name}
                onChange={(event) =>
                  setGroupForm((current: any) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Grupo Comercial Nova"
                className={inputClass}
                disabled={Boolean(group && mode === "edit" && updating)}
              />
            </label>
            <label className={labelClass}>
              Descripción
              <textarea
                value={groupForm.description}
                onChange={(event) =>
                  setGroupForm((current: any) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Qué empresas, rubros o marcas agrupa"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border-primary/20 bg-primary/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
            <ShieldCheck className="size-5 text-primary" /> Módulos habilitados
            para el grupo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <ModuleSelector
            value={groupForm.enabledModules}
            onChange={(enabledModules) =>
              setGroupForm((current: any) => ({ ...current, enabledModules }))
            }
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Los rubros solo podrán heredar módulos seleccionados aquí. Luego
            cada sucursal podrá heredar del rubro o tener una selección más
            específica.
          </p>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border-primary/20 bg-primary/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-black uppercase">
            <Users className="size-5 text-primary" /> Manager principal
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          {manager ? (
            <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-background/60 p-4 sm:col-span-2">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="font-black">{manager.name}</p>
                <p className="text-sm text-muted-foreground">{manager.email}</p>
              </div>
              <Badge className="ml-auto">Manager propietario</Badge>
            </div>
          ) : (
            <>
              <label className={labelClass}>
                Nombre completo
                <input
                  value={managerForm.name}
                  onChange={(event) =>
                    setManagerForm((current: any) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Nombre del responsable"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Correo de acceso
                <input
                  type="email"
                  value={managerForm.email}
                  onChange={(event) =>
                    setManagerForm((current: any) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="manager@grupo.com"
                  className={inputClass}
                />
                <span
                  className={`mt-1 block text-[11px] font-normal ${managerEmailStatus === "taken" ? "text-destructive" : managerEmailStatus === "available" ? "text-emerald-600" : "text-muted-foreground"}`}
                >
                  {managerEmailStatus === "checking"
                    ? "Verificando disponibilidad…"
                    : managerEmailStatus === "taken"
                      ? "Este correo ya está registrado en otra cuenta"
                      : managerEmailStatus === "available"
                        ? "Correo disponible"
                        : managerEmailStatus === "error"
                          ? "No se pudo verificar el correo; intenta nuevamente"
                          : "Debe ser un correo válido y único"}
                </span>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Contraseña inicial
                <input
                  type="password"
                  value={managerForm.password}
                  onChange={(event) =>
                    setManagerForm((current: any) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder="Contraseña segura"
                  className={inputClass}
                />
                <span className="mt-1 block text-[11px] font-normal">
                  {getPasswordError(managerForm.password) ||
                    "Debe cumplir la política de seguridad de NovaHub."}
                </span>
              </label>
            </>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={onNext}
          disabled={!group}
        >
          Continuar <ChevronRight className="ml-2 size-4" />
        </Button>
        {mode === "create" && (!group || draft) ? (
          <Button
            className="rounded-xl"
            disabled={!canCreateGroup || creating}
            onClick={onCreate}
          >
            {creating ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            {draft ? "Actualizar borrador" : "Guardar identidad y continuar"}
          </Button>
        ) : !manager ? (
          <Button
            className="rounded-xl"
            disabled={!canCreateGroup || creatingManager}
            onClick={onCreateManager}
          >
            {creatingManager ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 size-4" />
            )}
            Crear Manager
          </Button>
        ) : (
          <Button
            className="rounded-xl"
            disabled={
              updating ||
              !groupForm.name.trim() ||
              !groupForm.enabledModules.length
            }
            onClick={onUpdate}
          >
            {updating ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Guardar datos
          </Button>
        )}
      </div>
    </div>
  );
}

function UnitsStep({
  units,
  editMode,
  unitForm,
  setUnitForm,
  availableModules,
  creating,
  editingId,
  onCreate,
  onEdit,
  onDelete,
  onStatusChange,
  onCancelEdit,
  onNext,
}: any) {
  return (
    <div className="space-y-6">
      <SectionIntro
        icon={GitBranch}
        minimal={editMode}
        eyebrow="Paso 2"
        title="Define los rubros"
        description="Cada rubro separa el catálogo, precios, inventario y módulos operativos. Las sucursales del mismo rubro parten de esta configuración."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card className="rounded-3xl border-border/60">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase">
              Rubros creados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {units.map((unit: any) => (
              <div
                key={unit.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-black">{unit.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Array.isArray(unit.enabledModules) &&
                    unit.enabledModules.length
                      ? `${unit.enabledModules.length} módulos para sus sucursales`
                      : "Módulos por configurar"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={unit.isActive !== false ? "default" : "secondary"}
                  >
                    {unit.isActive !== false ? "Activo" : "Inactivo"}
                  </Badge>
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar rubro ${unit.name}`}
                      onClick={() => onEdit(unit)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  {onStatusChange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => onStatusChange(unit)}
                    >
                      {unit.isActive === false ? "Activar" : "Desactivar"}
                    </Button>
                  )}
                  {unit.__draft && onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Eliminar rubro ${unit.name}`}
                      onClick={() => onDelete(unit.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!units.length && (
              <EmptyState
                icon={GitBranch}
                text="Todavía no hay rubros. Crea al menos uno para separar operaciones."
              />
            )}
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-primary/20 bg-primary/[0.03]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase">
              <Plus className="size-4 text-primary" />{" "}
              {editingId ? "Editar rubro" : "Nuevo rubro"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <label className={labelClass}>
              Nombre
              <input
                value={unitForm.name}
                onChange={(event) =>
                  setUnitForm((current: any) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Tecnología"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Descripción
              <textarea
                value={unitForm.description}
                onChange={(event) =>
                  setUnitForm((current: any) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <ModuleSelector
              value={unitForm.enabledModules}
              availableModules={availableModules}
              onChange={(enabledModules) =>
                setUnitForm((current: any) => ({ ...current, enabledModules }))
              }
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl"
                disabled={!unitForm.name.trim() || creating}
                onClick={onCreate}
              >
                {creating
                  ? "Guardando…"
                  : editingId
                    ? "Guardar cambios"
                    : "Agregar rubro"}
              </Button>
              {editingId && (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={onCancelEdit}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <StepFooter
        onNext={onNext}
        nextLabel={
          units.length ? "Continuar a sucursales" : "Continuar sin rubro"
        }
      />
    </div>
  );
}

function WarehousesStep({
  units,
  branches,
  warehouses,
  editMode,
  form,
  setForm,
  creating,
  editingId,
  onCreate,
  onEdit,
  onDelete,
  onStatusChange,
  onCancelEdit,
  onNext,
}: any) {
  const selectedUnitBranches = branches.filter(
    (branch: any) => branch.businessUnitId === form.businessUnitId,
  );
  const toggleBranch = (branchId: string) =>
    setForm((current: any) => ({
      ...current,
      authorizedBranchIds: current.authorizedBranchIds.includes(branchId)
        ? current.authorizedBranchIds.filter((id: string) => id !== branchId)
        : [...current.authorizedBranchIds, branchId],
    }));
  return (
    <div className="space-y-6">
      <SectionIntro
        icon={Warehouse}
        minimal={editMode}
        eyebrow="Paso 4"
        title="Crea los almacenes del grupo"
        description="El almacén corporativo está fuera de la sucursal, pertenece a un rubro y solo podrá transferir hacia las sucursales que autorices. Las bodegas se crearán dentro de cada sucursal."
      />
      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase">
            Almacenes registrados
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((warehouse: any) => {
            const destinationNames = (warehouse.authorizedBranchIds || [])
              .map(
                (id: string) =>
                  branches.find((branch: any) => branch.id === id)?.name,
              )
              .filter(Boolean);
            return (
              <div
                key={warehouse.id}
                className="rounded-2xl border border-border/60 bg-muted/15 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black">{warehouse.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {warehouse.location || "Sin ubicación"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar almacén ${warehouse.name}`}
                        onClick={() => onEdit(warehouse)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    )}
                    {onStatusChange && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => onStatusChange(warehouse)}
                      >
                        {warehouse.isActive === false ? "Activar" : "Desactivar"}
                      </Button>
                    )}
                    {warehouse.__draft && onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar almacén ${warehouse.name}`}
                        onClick={() => onDelete(warehouse.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-[11px] font-semibold text-primary">
                  {units.find(
                    (unit: any) => unit.id === warehouse.businessUnitId,
                  )?.name || "Rubro pendiente de normalizar"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {destinationNames.length
                    ? `Abastece: ${destinationNames.join(", ")}`
                    : "Sin sucursales autorizadas"}
                </p>
              </div>
            );
          })}
          {!warehouses.length && (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState
                icon={Warehouse}
                text="Todavía no hay almacenes corporativos."
              />
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="rounded-3xl border-primary/20 bg-primary/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase">
            <Plus className="size-4 text-primary" />{" "}
            {editingId ? "Editar almacén" : "Nuevo almacén corporativo"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <label className={labelClass}>
            Nombre
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current: any) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Almacén Central Tecnología"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Ubicación
            <input
              value={form.location}
              onChange={(event) =>
                setForm((current: any) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
              placeholder="Managua"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Rubro
            <select
              value={form.businessUnitId}
              onChange={(event) =>
                setForm((current: any) => ({
                  ...current,
                  businessUnitId: event.target.value,
                  authorizedBranchIds: [],
                }))
              }
              className={inputClass}
              disabled={!units.length}
            >
              <option value="">
                {units.length ? "Selecciona un rubro" : "Crea primero un rubro"}
              </option>
              {units.map((unit: any) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-foreground">
              Sucursales que puede abastecer
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Solo aparecen sucursales del mismo rubro. Esta selección limitará
              las transferencias.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {selectedUnitBranches.map((branch: any) => (
                <label
                  key={branch.id}
                  className="flex items-center gap-2 rounded-xl border border-border/60 p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.authorizedBranchIds.includes(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                    className="size-4 accent-primary"
                  />
                  {branch.name}
                </label>
              ))}
              {!selectedUnitBranches.length && (
                <p className="text-xs text-muted-foreground">
                  Selecciona un rubro con sucursales creadas.
                </p>
              )}
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button
              className="rounded-xl"
              disabled={
                !form.name.trim() ||
                !form.businessUnitId ||
                !form.authorizedBranchIds.length ||
                creating
              }
              onClick={onCreate}
            >
              {creating
                ? "Guardando…"
                : editingId
                  ? "Guardar cambios"
                  : "Agregar almacén"}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={onCancelEdit}
              >
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <StepFooter
        onNext={onNext}
        nextLabel={
          warehouses.length ? "Continuar al resumen" : "Continuar sin almacén"
        }
      />
    </div>
  );
}

function BranchesStep({
  units,
  branches,
  editMode,
  availableModules,
  form,
  setForm,
  creating,
  editingId,
  canCreate,
  emailStatus,
  onCreate,
  onEdit,
  onDelete,
  onStatusChange,
  onCancelEdit,
  onNext,
}: any) {
  const selectedUnit = units.find(
    (unit: any) => unit.id === form.businessUnitId,
  );
  const availableBusinessTypes = units.length
    ? units
    : [{ id: "legacy-other", name: "Otro giro de negocio" }];
  return (
    <div className="space-y-6">
      <SectionIntro
        icon={Building2}
        minimal={editMode}
        eyebrow="Paso 3"
        title="Crea las sucursales operativas"
        description="El rubro define el catálogo y los módulos máximos. El tipo de negocio se elige únicamente entre los rubros existentes en este grupo."
      />
      <Card className="rounded-3xl border-border/60">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase">
            Sucursales del grupo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {branches.map((branch: any) => (
            <div
              key={branch.id}
              className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <BrandLogo src={branch.logo} alt={`Logo de ${branch.name}`} kind="branch" className="size-11 rounded-xl bg-primary/10" imageClassName="rounded-xl" />
                <div className="min-w-0">
                <p className="truncate font-black">{branch.name}</p>
                <p className="text-xs text-muted-foreground">
                  {units.find((unit: any) => unit.id === branch.businessUnitId)
                    ?.name || "Rubro pendiente de normalizar"}{" "}
                  · {branch._count?.users || 0} usuarios ·{" "}
                  {branch.moduleMode === "CUSTOM"
                    ? "módulos personalizados"
                    : "módulos heredados del rubro"}
                </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {branch.businessType ||
                    getBusinessTypeLabel(branch.industry, branch.subIndustry)}
                </Badge>
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar sucursal ${branch.name}`}
                    onClick={() => onEdit(branch)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                {onStatusChange && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => onStatusChange(branch)}
                  >
                    {branch.isActive === false ? "Activar" : "Desactivar"}
                  </Button>
                )}
                {branch.__draft && onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Eliminar sucursal ${branch.name}`}
                    onClick={() => onDelete(branch.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {!branches.length && (
            <EmptyState
              icon={Building2}
              text="Todavía no hay sucursales en este grupo."
            />
          )}
        </CardContent>
      </Card>
      <Card className="rounded-3xl border-primary/20 bg-primary/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-black uppercase">
            <Plus className="size-4 text-primary" />{" "}
            {editingId ? "Editar sucursal" : "Nueva sucursal"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <label className={labelClass}>
            Nombre comercial
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current: any) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Farmacia Central"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Rubro
            <select
              value={form.businessUnitId}
              onChange={(event) => {
                const unit = units.find(
                  (candidate: any) => candidate.id === event.target.value,
                );
                setForm((current: any) => ({
                  ...current,
                  businessUnitId: event.target.value,
                  businessType: unit?.name || "",
                  subIndustry: unit?.name || current.subIndustry,
                  enabledModules:
                    current.moduleMode === "CUSTOM"
                      ? unit?.enabledModules || availableModules
                      : current.enabledModules,
                }));
              }}
              className={inputClass}
              disabled={!units.length}
            >
              <option value="">
                {units.length ? "Selecciona un rubro" : "Crea primero un rubro"}
              </option>
              {units.map((unit: any) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Tipo de negocio
            <select
              value={
                units.find((unit: any) => unit.name === form.businessType)
                  ?.id ||
                selectedUnit?.id ||
                ""
              }
              onChange={(event) => {
                const selected = units.find(
                  (unit: any) => unit.id === event.target.value,
                );
                setForm((current: any) => ({
                  ...current,
                  businessType: selected?.name || "",
                  industry: "OTHER",
                  subIndustry: selected?.name || "",
                }));
              }}
              className={inputClass}
            >
              <option value="">Selecciona el rubro como giro de negocio</option>
              {availableBusinessTypes.map((unit: any) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 grid gap-4 rounded-2xl border border-border/60 bg-background/50 p-4 sm:grid-cols-[160px_minmax(0,1fr)]">
            <LogoPicker
              value={form.logo}
              label="Logo de la sucursal"
              alt={`Logo de ${form.name || "la sucursal"}`}
              helpText="Logo propio de esta sucursal."
              onChange={(logo) =>
                setForm((current: any) => ({ ...current, logo }))
              }
            />
            <div className="flex items-center text-sm leading-relaxed text-muted-foreground">
              La sucursal puede tener una identidad visual diferente. Si no
              cargas un logo, no heredará automáticamente el del grupo
              empresarial.
            </div>
          </div>
          <div className="sm:col-span-2 grid gap-4 rounded-2xl border border-border/60 bg-background/50 p-4 sm:grid-cols-2">
            <label className={labelClass}>
              Administrador de sucursal
              <input
                value={form.adminName}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    adminName: event.target.value,
                  }))
                }
                placeholder="Nombre completo"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Correo del administrador
              <input
                value={form.adminEmail}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    adminEmail: event.target.value,
                  }))
                }
                placeholder="admin@sucursal.com"
                className={inputClass}
              />
              <span
                className={`mt-1 block text-[11px] font-normal ${emailStatus === "taken" ? "text-destructive" : emailStatus === "available" ? "text-emerald-600" : "text-muted-foreground"}`}
              >
                {emailStatus === "checking"
                  ? "Verificando disponibilidad…"
                  : emailStatus === "taken"
                    ? "Este correo ya está registrado en otra cuenta"
                    : emailStatus === "available"
                      ? "Correo disponible"
                      : emailStatus === "error"
                        ? "No se pudo verificar el correo; intenta nuevamente"
                        : "Debe ser un correo válido y único"}
              </span>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Contraseña inicial
              <input
                type="password"
                value={form.adminPassword}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    adminPassword: event.target.value,
                  }))
                }
                placeholder="Contraseña segura"
                className={inputClass}
              />
              <span className="mt-1 block text-[11px] font-normal">
                {getPasswordError(form.adminPassword) ||
                  "La política se valida también en el backend."}
              </span>
            </label>
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-background/50 p-4">
            <label className={labelClass}>
              Módulos de la sucursal
              <select
                value={form.moduleMode}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    moduleMode: event.target.value,
                    enabledModules:
                      event.target.value === "CUSTOM" &&
                      !current.enabledModules.length
                        ? selectedUnit?.enabledModules || availableModules
                        : current.enabledModules,
                  }))
                }
                className={inputClass}
              >
                <option value="INHERIT">Heredar módulos del rubro</option>
                <option value="CUSTOM">Personalizar esta sucursal</option>
              </select>
            </label>
            {form.moduleMode === "CUSTOM" && (
              <div className="mt-3">
                <ModuleSelector
                  value={form.enabledModules}
                  availableModules={
                    selectedUnit?.enabledModules || availableModules
                  }
                  onChange={(enabledModules) =>
                    setForm((current: any) => ({ ...current, enabledModules }))
                  }
                />
              </div>
            )}
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button
              className="rounded-xl"
              disabled={!canCreate || creating}
              onClick={onCreate}
            >
              {creating
                ? "Guardando…"
                : editingId
                  ? "Guardar cambios"
                  : "Agregar sucursal"}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={onCancelEdit}
              >
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <StepFooter
        onNext={onNext}
        nextLabel={
          branches.length ? "Continuar a almacenes" : "Continuar sin sucursales"
        }
      />
    </div>
  );
}

function ModuleSelector({
  value,
  availableModules,
  onChange,
}: {
  value: string[];
  availableModules?: string[];
  onChange: (value: string[]) => void;
}) {
  const options = availableModules?.length
    ? ENTERPRISE_MODULE_OPTIONS.filter((module) =>
        availableModules.includes(module.id),
      )
    : ENTERPRISE_MODULE_OPTIONS;
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-wider text-foreground">
          Módulos operativos
        </p>
        <span className="text-[11px] text-muted-foreground">
          {value.length} seleccionados
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Esta selección no puede superar los módulos habilitados en el nivel
        superior.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((module) => {
          const checked = value.includes(module.id);
          return (
            <label
              key={module.id}
              className="flex cursor-pointer items-start gap-2 rounded-xl border border-border/60 p-3 transition hover:border-primary/40"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? value.filter((id) => id !== module.id)
                      : [...value, module.id],
                  )
                }
                className="mt-0.5 size-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-foreground">
                  {module.label}
                </span>
                <span className="block text-[10px] leading-relaxed text-muted-foreground">
                  {module.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SummaryStep({
  group,
  manager,
  units,
  warehouses,
  branches,
  onGoTo,
  onFinish,
  finishing,
  draft,
}: any) {
  return (
    <div className="space-y-6">
      <SectionIntro
        icon={CheckCircle2}
        eyebrow={
          draft ? "Borrador listo para confirmar" : "Configuración lista"
        }
        title="Jerarquía del grupo empresarial"
        description={
          draft
            ? "Revisa la configuración. Los datos permanecen en borrador y se crearán juntos al confirmar."
            : "El grupo ya puede crecer por rubros, almacenes corporativos y sucursales. Las bodegas se crearán dentro de cada sucursal en su operación propia."
        }
      />
      <Card className="overflow-hidden rounded-3xl border-border/60">
        <CardContent className="p-6 sm:p-8">
          <div className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <BrandLogo
                src={group?.logo}
                alt={`Logo de ${group?.name || "grupo empresarial"}`}
                className="size-12 rounded-2xl bg-primary text-primary-foreground ring-0"
                imageClassName="rounded-2xl"
              />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-primary">
                  Grupo empresarial
                </p>
                <h2 className="text-2xl font-black">{group?.name}</h2>
              </div>
            </div>
            <div className="my-6 h-px bg-border/60" />
            <div className="grid gap-4 md:grid-cols-4">
              <HierarchyMetric
                icon={ShieldCheck}
                label="Manager"
                value={manager?.name || "Pendiente"}
              />
              <HierarchyMetric
                icon={GitBranch}
                label="Rubros"
                value={units.length}
              />
              <HierarchyMetric
                icon={Warehouse}
                label="Almacenes"
                value={warehouses.length}
              />
              <HierarchyMetric
                icon={Building2}
                label="Sucursales"
                value={branches.length}
              />
            </div>
            {!!branches.length && (
              <div className="mt-5 flex min-w-0 flex-wrap gap-2 border-t border-border/60 pt-4">
                {branches.map((branch: any) => (
                  <div key={branch.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2">
                    <BrandLogo src={branch.logo} alt={`Logo de ${branch.name}`} kind="branch" className="size-7 rounded-lg bg-primary/10 ring-0" imageClassName="rounded-lg" />
                    <span className="max-w-40 truncate text-xs font-bold">{branch.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {steps.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/15 p-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Check className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-black">
                    {index + 1}. {item.label}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {item.caption}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => onGoTo("units")}
              >
                Administrar rubros
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => onGoTo("warehouses")}
              >
                Administrar almacenes
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => onGoTo("branches")}
              >
                Administrar sucursales
              </Button>
            </div>
            <Button
              className="rounded-xl"
              onClick={onFinish}
              disabled={finishing}
            >
              {finishing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 size-4" />
              )}
              {draft
                ? "Finalizar y crear grupo"
                : "Listo, cerrar configuración"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-3xl border-amber-500/20 bg-amber-500/[0.04]">
        <CardContent className="flex gap-3 p-5 text-sm text-muted-foreground">
          <Circle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p>
            El recuento de almacenamiento en la nube queda registrado como
            pendiente de producto. No se calcula ni se modifica en este flujo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
  minimal = false,
}: {
  icon: typeof Building2;
  eyebrow?: string;
  title: string;
  description?: string;
  minimal?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <div className="min-w-0">
        {!minimal && eyebrow && (
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className={`${minimal ? "" : "mt-1 "}text-2xl font-black tracking-tight`}>
          {title}
        </h2>
        {!minimal && description && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function StepFooter({
  onNext,
  nextLabel,
}: {
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="flex justify-end">
      <Button className="rounded-xl" onClick={onNext}>
        {nextLabel}
        <ChevronRight className="ml-2 size-4" />
      </Button>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof Building2;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      <Icon className="mb-3 size-7 text-primary/60" />
      <p>{text}</p>
    </div>
  );
}

function HierarchyMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <Icon className="mb-3 size-4 text-primary" />
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}
