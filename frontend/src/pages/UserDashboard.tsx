import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  Check,
  ClipboardCheck,
  Copy,
  FileText,
  FileUp,
  Home,
  ImageIcon,
  Landmark,
  Layers3,
  LogOut,
  MapPin,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { clearSessionUser, getSessionUser } from "@/lib/auth";
import {
  apiRequest,
  formatNu,
  getAuthToken,
  readFileAsDataUrl,
  shortWallet,
  type LeaseRecord,
  type ListingRecord,
  type PortfolioHolding,
} from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import property1 from "@/assets/property1.jpg";
import property2 from "@/assets/property2.jpg";
import property3 from "@/assets/property3.jpg";
import property4 from "@/assets/property4.jpg";
import property5 from "@/assets/property5.jpg";
import property6 from "@/assets/property6.jpg";

const propertyImages = [property1, property2, property3, property4, property5, property6];
const MAX_PROPERTY_SHARES = 10_000;
const propertyTypeOptions = ["Residential", "Commercial", "Land", "Mixed-use", "Industrial"];

const emptyDocumentForm = {
  title: "",
  location: "",
  threeWordLocation: "",
  propertyType: "Residential",
  pricePerShare: "500",
  requestedListingShares: "2500",
  description: "",
};

const emptyResaleForm = {
  tokenId: "",
  sharesForSale: "100",
  pricePerShare: "500",
};

const emptyLeaseForm = {
  tokenId: "",
  lesseeWallet: "",
  shareAmount: "1000",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  rentAmount: "10000",
  depositAmount: "10000",
  notes: "",
};

const serviceLinks = [
  { href: "#submit-property", label: "Submit property", icon: FileUp },
  { href: "#marketplace", label: "Registry listings", icon: Landmark },
  { href: "#purchase", label: "Purchase shares", icon: ShoppingCart },
  { href: "#portfolio", label: "Portfolio records", icon: Layers3 },
];

const UserDashboard = () => {
  const navigate = useNavigate();
  const sessionUser = getSessionUser();
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [leases, setLeases] = useState<LeaseRecord[]>([]);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [documentForm, setDocumentForm] = useState(emptyDocumentForm);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [resaleForm, setResaleForm] = useState(emptyResaleForm);
  const [leaseForm, setLeaseForm] = useState(emptyLeaseForm);
  const [copiedWallet, setCopiedWallet] = useState("");

  const wallet = sessionUser?.walletAddress || sessionUser?.wallet || "";
  const token = getAuthToken(sessionUser);

  useEffect(() => {
    if (!sessionUser) {
      navigate("/login");
      return;
    }
    if (sessionUser.role === "admin") {
      navigate("/admin-dashboard");
    }
  }, [navigate, sessionUser]);

  const loadDashboard = useCallback(async () => {
    if (!wallet) {
      setLoading(false);
      return;
    }

    try {
      const [listingData, portfolioData] = await Promise.all([
        apiRequest<{ listings: ListingRecord[] }>("/api/listings"),
        apiRequest<{ holdings: PortfolioHolding[]; leases: LeaseRecord[] }>(`/api/portfolio/${wallet}`, { token }),
      ]);
      setListings(listingData.listings);
      setHoldings(portfolioData.holdings);
      setLeases(portfolioData.leases);
      setSelectedListingId((current) => current || listingData.listings[0]?.id || "");
      setResaleForm((current) => ({ ...current, tokenId: current.tokenId || portfolioData.holdings[0]?.tokenId || "" }));
      setLeaseForm((current) => ({ ...current, tokenId: current.tokenId || portfolioData.holdings[0]?.tokenId || "" }));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backend unavailable. Start the backend server.");
    } finally {
      setLoading(false);
    }
  }, [token, wallet]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === selectedListingId) || listings[0],
    [listings, selectedListingId],
  );
  const selectedListingIndex = useMemo(() => {
    const index = listings.findIndex((listing) => listing.id === selectedListingId);
    return Math.max(index, 0);
  }, [listings, selectedListingId]);
  const selectedResaleHolding = useMemo(
    () => holdings.find((holding) => holding.tokenId === resaleForm.tokenId),
    [holdings, resaleForm.tokenId],
  );
  const selectedLeaseHolding = useMemo(
    () => holdings.find((holding) => holding.tokenId === leaseForm.tokenId),
    [holdings, leaseForm.tokenId],
  );
  const requestedListingShares = Number(documentForm.requestedListingShares || 0);
  const requestedPricePerShare = Number(documentForm.pricePerShare || 0);
  const requestedTotalAsk = requestedListingShares * requestedPricePerShare;
  const resaleShares = Number(resaleForm.sharesForSale || 0);
  const resalePrice = Number(resaleForm.pricePerShare || 0);
  const resaleTotalAsk = resaleShares * resalePrice;
  const totalSharesOwned = holdings.reduce((total, holding) => total + Number(holding.balance || 0), 0);
  const activeLeaseCount = leases.filter((lease) => lease.status === "ACTIVE").length;
  const photoPreviewUrl = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : ""), [photoFile]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  useEffect(() => {
    setQty((current) => Math.min(Math.max(current, 1), selectedListing?.sharesForSale || 1));
  }, [selectedListing?.id, selectedListing?.sharesForSale]);

  const showNextListing = useCallback(() => {
    if (!listings.length) {
      return;
    }

    const nextIndex = (selectedListingIndex + 1) % listings.length;
    setSelectedListingId(listings[nextIndex]?.id || "");
  }, [listings, selectedListingIndex]);

  const stats = useMemo(
    () => [
      { title: "Registry listings", value: String(listings.length), description: "Approved offers available", icon: Landmark },
      { title: "Shares owned", value: totalSharesOwned.toLocaleString("en-IN"), description: "Across verified holdings", icon: Layers3 },
      { title: "Active leases", value: String(activeLeaseCount), description: "Lease records in force", icon: CalendarDays },
      { title: "Identity status", value: wallet ? "Verified" : "Pending", description: wallet ? "NDI session active" : "Sign in required", icon: BadgeCheck },
    ],
    [activeLeaseCount, listings.length, totalSharesOwned, wallet],
  );

  const buyShares = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedListing) {
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      await apiRequest("/api/orders", {
        method: "POST",
        token,
        body: JSON.stringify({ sessionToken: token, listingId: selectedListing.id, qty }),
      });
      setMessage(`Purchase complete: ${qty.toLocaleString("en-IN")} shares transferred to your wallet.`);
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Purchase failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pricePerShare = Number(documentForm.pricePerShare);
    const requestedShares = Number(documentForm.requestedListingShares);

    if (!documentForm.title.trim() || !documentForm.location.trim()) {
      setMessage("Enter the property title and location before submitting.");
      return;
    }
    if (!documentFile) {
      setMessage("Upload the legal document bundle before submitting.");
      return;
    }
    if (!Number.isFinite(pricePerShare) || pricePerShare <= 0) {
      setMessage("Price per share must be greater than zero.");
      return;
    }
    if (!Number.isInteger(requestedShares) || requestedShares < 0 || requestedShares > MAX_PROPERTY_SHARES) {
      setMessage("Initial shares to list must be a whole number from 0 to 10,000.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const documentData = await readFileAsDataUrl(documentFile);
      const photoData = photoFile ? await readFileAsDataUrl(photoFile) : undefined;
      await apiRequest("/api/documents/submit", {
        method: "POST",
        token,
        body: JSON.stringify({
          sessionToken: token,
          ...documentForm,
          pricePerShare,
          requestedListingShares: requestedShares,
          documentName: documentFile.name,
          documentData,
          photoName: photoFile?.name,
          photoData,
        }),
      });
      setDocumentForm(emptyDocumentForm);
      setDocumentFile(null);
      setPhotoFile(null);
      setMessage("Document submitted. Admin approval will mint ERC-6909 shares and open the requested listing.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Document submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const createResaleListing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sharesForSale = Number(resaleForm.sharesForSale);
    const pricePerShare = Number(resaleForm.pricePerShare);

    if (!resaleForm.tokenId) {
      setMessage("Choose a holding before creating a resale listing.");
      return;
    }
    if (!Number.isInteger(sharesForSale) || sharesForSale < 1 || sharesForSale > Number(selectedResaleHolding?.balance || 0)) {
      setMessage("Shares for sale must be within your available holding balance.");
      return;
    }
    if (!Number.isFinite(pricePerShare) || pricePerShare <= 0) {
      setMessage("Price per share must be greater than zero.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      await apiRequest("/api/listings", {
        method: "POST",
        token,
        body: JSON.stringify({
          sessionToken: token,
          tokenId: resaleForm.tokenId,
          sharesForSale,
          pricePerShare,
          listingType: "SECONDARY",
        }),
      });
      setResaleForm((current) => ({ ...current, sharesForSale: "100" }));
      setMessage("Secondary listing created and approved for marketplace transfer.");
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create resale listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const createLeaseAgreement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const shareAmount = Number(leaseForm.shareAmount);
    const rentAmount = Number(leaseForm.rentAmount);
    const depositAmount = Number(leaseForm.depositAmount);
    const startTime = Date.parse(leaseForm.startDate);
    const endTime = Date.parse(leaseForm.endDate);

    if (!leaseForm.tokenId) {
      setMessage("Choose a holding before creating a lease agreement.");
      return;
    }
    if (!Number.isInteger(shareAmount) || shareAmount < 1 || shareAmount > Number(selectedLeaseHolding?.balance || 0)) {
      setMessage("Shares leased must be within your available holding balance.");
      return;
    }
    if (!leaseForm.lesseeWallet.trim()) {
      setMessage("Enter the lessee wallet address before recording the lease.");
      return;
    }
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) {
      setMessage("Lease end date must be after the start date.");
      return;
    }
    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      setMessage("Monthly rent must be greater than zero.");
      return;
    }
    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      setMessage("Deposit cannot be negative.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      await apiRequest("/api/leases", {
        method: "POST",
        token,
        body: JSON.stringify({
          sessionToken: token,
          tokenId: leaseForm.tokenId,
          lesseeWallet: leaseForm.lesseeWallet,
          shareAmount,
          startDate: leaseForm.startDate,
          endDate: leaseForm.endDate,
          rentAmount,
          depositAmount,
          notes: leaseForm.notes,
        }),
      });
      setLeaseForm((current) => ({ ...emptyLeaseForm, tokenId: current.tokenId }));
      setMessage("Lease agreement recorded on-chain and active shares locked.");
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create lease agreement.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDocumentFile = (event: ChangeEvent<HTMLInputElement>) => {
    setDocumentFile(event.target.files?.[0] ?? null);
  };

  const onPhotoFile = (event: ChangeEvent<HTMLInputElement>) => {
    setPhotoFile(event.target.files?.[0] ?? null);
  };

  const copyWallet = useCallback(async (value: string) => {
    const walletValue = value.trim();
    if (!walletValue || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(walletValue);
      setCopiedWallet(walletValue);
      window.setTimeout(() => {
        setCopiedWallet((current) => (current === walletValue ? "" : current));
      }, 1200);
    } catch {
      setMessage("Unable to copy wallet address from this browser session.");
    }
  }, []);

  const logout = () => {
    clearSessionUser();
    navigate("/login");
  };

  return (
    <main className="min-h-screen bg-[#eef2f5] text-foreground">
      <header className="border-b border-primary/20 bg-primary text-white shadow-sm">
        <div className="bg-[#7a1f2f]">
          <div className="container mx-auto flex min-h-9 flex-wrap items-center justify-between gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/90">
            <span className="inline-flex items-center gap-2">
              <Landmark size={14} />
              Royal Government Service Gateway
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={14} />
              Secure citizen property session
            </span>
          </div>
        </div>

        <div className="container mx-auto flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-gold text-primary">
              <Building2 size={22} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold md:text-lg">Digital Property Services Portal</span>
              <span className="block truncate text-xs font-medium text-white/70">Citizen dashboard</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-sm border border-white/25 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:border-gold hover:text-gold"
            >
              <Home size={15} />
              Home
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-sm bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary hover:bg-gold-light"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-white">
        <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-sm border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <BadgeCheck size={14} />
              NDI verified access
            </div>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight text-primary md:text-4xl">Citizen property services workspace</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
              Submit property records for review, browse approved share listings, manage owned holdings, and record lease agreements from one official service area.
            </p>
          </div>

          <div className="border border-border bg-[#f8fafc] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Citizen profile</div>
                <div className="mt-1 font-semibold text-primary">{sessionUser?.displayName || "Verified citizen"}</div>
              </div>
              <span className="rounded-sm border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Active</span>
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              <StatusLine icon={Wallet} label="Wallet" value={shortWallet(wallet) || "Not connected"}>
                <WalletCopyButton wallet={wallet} copied={copiedWallet === wallet.trim()} label="Copy wallet address" onCopy={copyWallet} />
              </StatusLine>
              <StatusLine icon={FileText} label="Citizen ID" value={sessionUser?.idNumberDisplay || "NDI verified"} />
              <StatusLine icon={ShieldCheck} label="Service level" value="Blockchain registry enabled" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.title} {...stat} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-[#f8fafc]">
        <div className="container mx-auto flex flex-wrap gap-2 px-4 py-3">
          {serviceLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-2 rounded-sm border border-border bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary shadow-sm hover:border-gold/60"
            >
              <link.icon size={14} className="text-gold" />
              {link.label}
            </a>
          ))}
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-4 py-8 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="border border-border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service menu</div>
            <nav className="mt-3 grid gap-2">
              {serviceLinks.map((link) => (
                <a key={link.href} href={link.href} className="flex items-center gap-3 border border-border bg-[#f8fafc] px-3 py-3 text-sm font-semibold text-primary hover:border-gold/60">
                  <link.icon size={16} className="text-gold" />
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="border border-border bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current service state</div>
            <div className="mt-3 space-y-3 text-sm">
              <StatusLine icon={ShieldCheck} label="Identity" value={wallet ? "NDI verified" : "Pending"} />
              <StatusLine icon={Landmark} label="Registry" value={loading ? "Syncing" : "Available"} />
              <StatusLine icon={ClipboardCheck} label="Documents" value="Encrypted review flow" />
            </div>
          </div>
        </aside>

        <div className="space-y-6">
          {message && (
            <div aria-live="polite" className="border border-gold/30 bg-gold/10 px-4 py-3 text-sm font-medium text-primary">
              {message}
            </div>
          )}

          <section id="submit-property" className="border border-border bg-white shadow-sm">
            <SectionHeader
              icon={ClipboardCheck}
              kicker="Citizen services"
              title="Property service requests"
              description="Submit records for officer review, place owned shares on resale, or register lease usage rights."
            />

            <Tabs defaultValue="submit" className="border-t border-border p-4 md:p-5">
              <TabsList className="grid h-auto w-full grid-cols-3 rounded-sm border border-border bg-[#eef2f5] p-1">
                <TabsTrigger value="submit" className="gap-2 rounded-sm text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <FileUp size={14} />
                  Submit
                </TabsTrigger>
                <TabsTrigger value="resale" className="gap-2 rounded-sm text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <RotateCcw size={14} />
                  Resale
                </TabsTrigger>
                <TabsTrigger value="lease" className="gap-2 rounded-sm text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <CalendarDays size={14} />
                  Lease
                </TabsTrigger>
              </TabsList>

              <TabsContent value="submit" className="mt-5">
                <PanelIntro
                  icon={FileUp}
                  title="Submit property documents"
                  description="Legal bundles are encrypted before storage. Photos are used for registry listing records after approval."
                />

                <form onSubmit={submitDocument} className="mt-5 grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field required label="Property title" value={documentForm.title} placeholder="e.g. Norzin Lam Commercial Unit" onChange={(value) => setDocumentForm((current) => ({ ...current, title: value }))} />
                    <Field required label="Dzongkhag / locality" value={documentForm.location} placeholder="e.g. Thimphu, Bhutan" onChange={(value) => setDocumentForm((current) => ({ ...current, location: value }))} />
                    <Field
                      label="Precise 3-word location"
                      value={documentForm.threeWordLocation}
                      placeholder="river.market.gold"
                      helper="Optional map reference for field officers and buyers."
                      onChange={(value) => setDocumentForm((current) => ({ ...current, threeWordLocation: value }))}
                    />
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-muted-foreground">Property type</span>
                      <select
                        value={documentForm.propertyType}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, propertyType: event.target.value }))}
                        className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-gold/60"
                      >
                        {propertyTypeOptions.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field required label="Price per share (Nu.)" type="number" min={1} step={1} value={documentForm.pricePerShare} helper="Used for the initial listing after approval." onChange={(value) => setDocumentForm((current) => ({ ...current, pricePerShare: value }))} />
                    <Field required label="Initial shares to list" type="number" min={0} max={MAX_PROPERTY_SHARES} step={1} value={documentForm.requestedListingShares} helper="Use 0 to keep all shares private after approval." onChange={(value) => setDocumentForm((current) => ({ ...current, requestedListingShares: value }))} />
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-muted-foreground">
                        Legal document bundle <span className="text-[#7a1f2f]">*</span>
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.zip,.doc,.docx,.png,.jpg,.jpeg"
                        required
                        onChange={onDocumentFile}
                        className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-foreground outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-primary-foreground"
                      />
                      <span className="mt-2 block text-xs leading-5 text-muted-foreground">PDF, ZIP, Word, or scanned image files are encrypted before storage.</span>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-muted-foreground">Property photo</span>
                      <div className="grid gap-4 border border-border bg-[#f8fafc] p-3 sm:grid-cols-[160px_1fr]">
                        <div className="flex h-28 items-center justify-center overflow-hidden rounded-sm border border-border bg-white">
                          {photoPreviewUrl ? (
                            <img src={photoPreviewUrl} alt="Selected property" className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon size={28} className="text-gold" />
                          )}
                        </div>
                        <div className="flex flex-col justify-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={onPhotoFile}
                            className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-foreground outline-none file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-wide file:text-primary-foreground"
                          />
                          <p className="text-sm text-muted-foreground">
                            {photoFile ? photoFile.name : "This image appears on marketplace and official review cards after submission."}
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-muted-foreground">Description</span>
                    <textarea
                      value={documentForm.description}
                      placeholder="Briefly describe the property, parcel, building condition, and ownership context."
                      onChange={(event) => setDocumentForm((current) => ({ ...current, description: event.target.value }))}
                      className="min-h-24 w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-gold/60"
                    />
                  </label>
                  <div className="border border-border bg-[#f8fafc] px-4 py-3 text-sm text-muted-foreground">
                    Initial listing estimate: <span className="font-semibold text-primary">{requestedListingShares.toLocaleString("en-IN")}</span> shares at{" "}
                    <span className="font-semibold text-primary">{formatNu(requestedPricePerShare || 0)}</span> each
                    {requestedTotalAsk > 0 ? (
                      <>
                        {" "}
                        for <span className="font-semibold text-primary">{formatNu(requestedTotalAsk)}</span>.
                      </>
                    ) : (
                      "."
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex w-fit items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-gold-light disabled:opacity-60"
                  >
                    <FileUp size={16} />
                    Submit for review
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="resale" className="mt-5">
                <PanelIntro icon={RotateCcw} title="Create resale listing" description="Relist all or part of a verified holding for citizen marketplace purchase." />

                <form onSubmit={createResaleListing} className="mt-5 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-muted-foreground">Property holding</span>
                    <select
                      value={resaleForm.tokenId}
                      required
                      onChange={(event) => setResaleForm((current) => ({ ...current, tokenId: event.target.value }))}
                      className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-gold/60"
                    >
                      {!holdings.length && <option value="">No holdings available</option>}
                      {holdings.map((holding) => (
                        <option key={holding.tokenId} value={holding.tokenId}>
                          {holding.property?.title || `Token ${holding.tokenId}`} - {holding.balance.toLocaleString("en-IN")} shares
                        </option>
                      ))}
                    </select>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                      {selectedResaleHolding ? `Available balance: ${selectedResaleHolding.balance.toLocaleString("en-IN")} shares.` : "Purchase or receive approved shares before creating a resale listing."}
                    </span>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field required label="Shares to list" type="number" min={1} max={selectedResaleHolding?.balance || MAX_PROPERTY_SHARES} step={1} value={resaleForm.sharesForSale} onChange={(value) => setResaleForm((current) => ({ ...current, sharesForSale: value }))} />
                    <Field required label="Ask price per share (Nu.)" type="number" min={1} step={1} value={resaleForm.pricePerShare} onChange={(value) => setResaleForm((current) => ({ ...current, pricePerShare: value }))} />
                  </div>
                  <div className="border border-border bg-[#f8fafc] px-4 py-3 text-sm text-muted-foreground">
                    Listing value: <span className="font-semibold text-primary">{Number.isFinite(resaleTotalAsk) ? formatNu(resaleTotalAsk) : "Nu. 0"}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || holdings.length === 0}
                    className="inline-flex w-fit items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-gold-light disabled:opacity-60"
                  >
                    <RotateCcw size={16} />
                    Create listing
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="lease" className="mt-5">
                <PanelIntro icon={CalendarDays} title="Create lease agreement" description="Record usage rights while retaining ownership of the underlying property shares." />

                <form onSubmit={createLeaseAgreement} className="mt-5 grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-muted-foreground">Property holding</span>
                    <select
                      value={leaseForm.tokenId}
                      required
                      onChange={(event) => setLeaseForm((current) => ({ ...current, tokenId: event.target.value }))}
                      className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-gold/60"
                    >
                      {!holdings.length && <option value="">No holdings available</option>}
                      {holdings.map((holding) => (
                        <option key={holding.tokenId} value={holding.tokenId}>
                          {holding.property?.title || `Token ${holding.tokenId}`} - {holding.balance.toLocaleString("en-IN")} shares
                        </option>
                      ))}
                    </select>
                    <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                      {selectedLeaseHolding ? `Lease up to ${selectedLeaseHolding.balance.toLocaleString("en-IN")} shares from this holding.` : "A lease can be created only from shares you own."}
                    </span>
                  </label>
                  <Field required label="Lessee wallet address" value={leaseForm.lesseeWallet} placeholder="0x..." helper="The lessee must also be NDI-verified on the platform." onChange={(value) => setLeaseForm((current) => ({ ...current, lesseeWallet: value }))} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field required label="Shares leased" type="number" min={1} max={selectedLeaseHolding?.balance || MAX_PROPERTY_SHARES} step={1} value={leaseForm.shareAmount} onChange={(value) => setLeaseForm((current) => ({ ...current, shareAmount: value }))} />
                    <Field required label="Monthly rent (Nu.)" type="number" min={1} step={1} value={leaseForm.rentAmount} onChange={(value) => setLeaseForm((current) => ({ ...current, rentAmount: value }))} />
                    <Field label="Deposit (Nu.)" type="number" min={0} step={1} value={leaseForm.depositAmount} onChange={(value) => setLeaseForm((current) => ({ ...current, depositAmount: value }))} />
                    <Field required label="Start date" type="date" value={leaseForm.startDate} onChange={(value) => setLeaseForm((current) => ({ ...current, startDate: value }))} />
                    <Field required label="End date" type="date" min={leaseForm.startDate} value={leaseForm.endDate} onChange={(value) => setLeaseForm((current) => ({ ...current, endDate: value }))} />
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-muted-foreground">Lease notes</span>
                    <textarea
                      value={leaseForm.notes}
                      placeholder="Record key lease terms, permitted use, or reference numbers. The notes are hashed into the lease terms proof."
                      onChange={(event) => setLeaseForm((current) => ({ ...current, notes: event.target.value }))}
                      className="min-h-20 w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-foreground outline-none focus:border-gold/60"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={submitting || holdings.length === 0}
                    className="inline-flex w-fit items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-gold-light disabled:opacity-60"
                  >
                    <CalendarDays size={16} />
                    Record lease on-chain
                  </button>
                </form>
              </TabsContent>
            </Tabs>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section id="marketplace" className="border border-border bg-white shadow-sm">
              <SectionHeader icon={Landmark} kicker="Public registry marketplace" title="Approved property share offers" description="Select an approved listing and review its registry details before purchase.">
                {listings.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedListing?.id || ""}
                      onChange={(event) => setSelectedListingId(event.target.value)}
                      className="h-10 max-w-full rounded-sm border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-gold/60"
                    >
                      {listings.map((listing, index) => (
                        <option key={listing.id} value={listing.id}>
                          {index + 1}. {listing.property?.title || `Token ${listing.tokenId}`}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={showNextListing}
                      disabled={listings.length <= 1}
                      title="Show next listing"
                      aria-label="Show next listing"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-sm bg-primary text-primary-foreground transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
              </SectionHeader>

              <div className="border-t border-border p-4 md:p-5">
                {loading && <p className="text-sm text-muted-foreground">Loading live registry listings...</p>}

                {!loading && listings.length === 0 ? (
                  <div className="border border-dashed border-primary/25 bg-[#f8fafc] p-5">
                    <h3 className="text-lg font-bold text-primary">No active listings yet</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Approved properties will appear here after officer review and minting. You can submit a property package for review above.
                    </p>
                    <a
                      href="#submit-property"
                      className="mt-4 inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground hover:bg-gold-light"
                    >
                      <FileUp size={16} />
                      Submit property
                    </a>
                  </div>
                ) : selectedListing ? (
                  <div className="grid overflow-hidden border border-border bg-white md:grid-cols-[240px_1fr]">
                    <div className="relative min-h-56 bg-[#eef2f5]">
                      <img
                        src={selectedListing.property?.imageUrl || propertyImages[selectedListingIndex % propertyImages.length]}
                        alt={selectedListing.property?.title || selectedListing.tokenId}
                        loading="lazy"
                        width={480}
                        height={420}
                        className="h-full min-h-56 w-full object-cover"
                      />
                      <div className="absolute left-3 top-3 rounded-sm border border-white/70 bg-white/95 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                        {selectedListing.listingType}
                      </div>
                    </div>

                    <div className="p-4 md:p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="text-xl font-bold text-primary">{selectedListing.property?.title || `Token ${selectedListing.tokenId}`}</h3>
                          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin size={15} className="text-gold" />
                            {selectedListing.property?.location || "Verified property"}
                          </div>
                          {selectedListing.property?.threeWordLocation && <div className="mt-1 text-xs font-semibold text-primary">///{selectedListing.property.threeWordLocation}</div>}
                        </div>
                        <div className="rounded-sm bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">{formatNu(selectedListing.pricePerShare)} / share</div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                        <Metric label="Shares available" value={selectedListing.sharesForSale.toLocaleString("en-IN")} />
                        <Metric label="Ownership offered" value={`${selectedListing.ownershipPercentForSale}%`} />
                        <Metric label="Current holders" value={String(selectedListing.holderCount)} />
                        <Metric label="Total ask" value={formatNu(selectedListing.totalAsk)} />
                      </div>
                      <div className="mt-4 flex items-center gap-2 break-all border-t border-border pt-4 text-xs text-muted-foreground">
                        <Wallet size={14} className="text-gold" />
                        <span>Seller wallet {shortWallet(selectedListing.sellerWallet)}</span>
                        <WalletCopyButton
                          wallet={selectedListing.sellerWallet}
                          copied={copiedWallet === selectedListing.sellerWallet.trim()}
                          label="Copy seller wallet address"
                          onCopy={copyWallet}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section id="purchase" className="border border-border bg-white shadow-sm">
              <SectionHeader icon={SlidersHorizontal} kicker="Purchase desk" title="Fractional purchase" description="Choose the share quantity for the currently selected listing." />

              <div className="border-t border-border p-4 md:p-5">
                {selectedListing ? (
                  <form onSubmit={buyShares} className="space-y-5">
                    <div className="border border-border bg-[#f8fafc] p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected listing</div>
                      <div className="mt-1 font-semibold text-primary">{selectedListing.property?.title || selectedListing.tokenId}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {selectedListing.sharesForSale.toLocaleString("en-IN")} shares available at {formatNu(selectedListing.pricePerShare)} each
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted-foreground">Quantity</span>
                        <span className="font-semibold text-primary">{qty.toLocaleString("en-IN")} shares</span>
                      </div>
                      <Slider value={[qty]} min={1} max={Math.max(selectedListing.sharesForSale, 1)} step={1} onValueChange={(value) => setQty(value[0] || 1)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Metric label="Ownership" value={`${((qty / (selectedListing.property?.totalSupply || 10000)) * 100).toFixed(2)}%`} />
                      <Metric label="Total payable" value={formatNu(qty * selectedListing.pricePerShare)} />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-semibold uppercase tracking-wide text-primary-foreground transition-colors hover:bg-gold-light disabled:opacity-60"
                    >
                      <ShoppingCart size={16} />
                      {submitting ? "Processing..." : "Buy shares"}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-muted-foreground">No active listings available.</p>
                )}
              </div>
            </section>
          </div>

          <section id="portfolio" className="border border-border bg-white shadow-sm">
            <SectionHeader icon={Layers3} kicker="Citizen records" title="Share portfolio and lease register" description="Balances and leases are derived from the platform registry state." />

            <div className="grid gap-6 border-t border-border p-4 md:p-5">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-primary">Owned share records</h3>
                  <span className="rounded-sm border border-border bg-[#f8fafc] px-2 py-1 text-xs font-semibold text-muted-foreground">{holdings.length} records</span>
                </div>

                <div className="grid gap-3">
                  {holdings.length > 0 ? (
                    holdings.map((holding) => (
                      <div key={holding.tokenId} className="border border-border bg-[#f8fafc] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-semibold text-primary">{holding.property?.title || `Token ${holding.tokenId}`}</div>
                            <div className="mt-1 text-sm text-muted-foreground">Token ID {holding.tokenId}</div>
                          </div>
                          <div className="rounded-sm border border-gold/30 bg-gold/10 px-3 py-1 text-sm font-semibold text-primary">{holding.percentage}% ownership</div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <Metric label="Shares held" value={holding.balance.toLocaleString("en-IN")} />
                          <Metric label="Estimated value" value={formatNu(holding.estimatedValue)} />
                          <Metric label="Status" value={holding.property?.status || "ACTIVE"} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="border border-border bg-[#f8fafc] p-4 text-sm text-muted-foreground">
                      No shares yet. Purchase from the marketplace to populate your portfolio.
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-primary">Lease agreements</h3>
                  <span className="rounded-sm border border-border bg-[#f8fafc] px-2 py-1 text-xs font-semibold text-muted-foreground">{leases.length} records</span>
                </div>

                <div className="grid gap-3">
                  {leases.length > 0 ? (
                    leases.map((lease) => (
                      <div key={lease.id} className="border border-border bg-[#f8fafc] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="font-semibold text-primary">{lease.property?.title || `Token ${lease.tokenId}`}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {new Date(lease.startDateIso).toLocaleDateString()} - {new Date(lease.endDateIso).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="rounded-sm border border-gold/30 bg-gold/10 px-3 py-1 text-sm font-semibold text-primary">{lease.status}</div>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <Metric label="Shares leased" value={lease.shareAmount.toLocaleString("en-IN")} />
                          <Metric label="Rent" value={formatNu(lease.rentAmount)} />
                          <Metric label="Chain lease" value={lease.chainLeaseId || "pending"} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex min-w-0 items-center gap-1 break-all">
                            {shortWallet(lease.lessorWallet)}
                            <WalletCopyButton
                              wallet={lease.lessorWallet}
                              copied={copiedWallet === lease.lessorWallet.trim()}
                              label="Copy lessor wallet address"
                              onCopy={copyWallet}
                            />
                          </span>
                          <span>to</span>
                          <span className="inline-flex min-w-0 items-center gap-1 break-all">
                            {shortWallet(lease.lesseeWallet)}
                            <WalletCopyButton
                              wallet={lease.lesseeWallet}
                              copied={copiedWallet === lease.lesseeWallet.trim()}
                              label="Copy lessee wallet address"
                              onCopy={copyWallet}
                            />
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="border border-border bg-[#f8fafc] p-4 text-sm text-muted-foreground">No lease agreements for this wallet yet.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
};

const SectionHeader = ({
  icon: Icon,
  kicker,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  children?: ReactNode;
}) => (
  <div className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between md:p-5">
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gold">{kicker}</div>
        <h2 className="mt-1 text-xl font-bold text-primary md:text-2xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
    {children}
  </div>
);

const PanelIntro = ({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) => (
  <div className="flex items-start gap-3 border border-border bg-[#f8fafc] p-4">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-gold/10 text-gold">
      <Icon size={20} />
    </div>
    <div>
      <h3 className="font-bold text-primary">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  </div>
);

const StatusLine = ({ icon: Icon, label, value, children }: { icon: LucideIcon; label: string; value: string; children?: ReactNode }) => (
  <div className="flex items-start gap-2">
    <Icon size={15} className="mt-0.5 shrink-0 text-gold" />
    <div className="min-w-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-medium text-primary">{value}</span>
        {children}
      </div>
    </div>
  </div>
);

const WalletCopyButton = ({
  wallet,
  copied,
  label,
  onCopy,
}: {
  wallet: string;
  copied: boolean;
  label: string;
  onCopy: (wallet: string) => Promise<void>;
}) => {
  if (!wallet.trim()) {
    return null;
  }

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={() => void onCopy(wallet)}
      title={copied ? "Copied" : label}
      aria-label={label}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-primary/15 bg-white text-primary transition-colors hover:border-gold/70 hover:text-gold"
    >
      <Icon size={13} />
    </button>
  );
};

const StatCard = ({ title, value, description, icon: Icon }: { title: string; value: string; description: string; icon: LucideIcon }) => (
  <div className="border border-border bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <Icon size={17} className="text-gold" />
    </div>
    <div className="mt-3 text-2xl font-bold text-primary">{value}</div>
    <div className="mt-1 text-sm text-muted-foreground">{description}</div>
  </div>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="border border-border/80 bg-white p-3">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
  </div>
);

const Field = ({
  label,
  value,
  type = "text",
  placeholder,
  helper,
  required = false,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  onChange: (value: string) => void;
}) => (
  <label className="block">
    <span className="mb-2 block text-sm font-medium text-muted-foreground">
      {label}
      {required && <span className="text-[#7a1f2f]"> *</span>}
    </span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-gold/60"
    />
    {helper && <span className="mt-2 block text-xs leading-5 text-muted-foreground">{helper}</span>}
  </label>
);

export default UserDashboard;
