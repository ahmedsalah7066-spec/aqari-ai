/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
// API calls are now handled by the backend
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  FileText, 
  Upload, 
  Loader2, 
  Scale, 
  Calculator,
  ChevronRight,
  AlertCircle,
  Calendar,
  DollarSign,
  User as UserIcon,
  Menu,
  X,
  Home,
  Key,
  Clock,
  Building,
  Info,
  Truck,
  ShieldCheck,
  MapPin,
  Maximize,
  GitCompare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { Contract, Installment, ContractAnalysis } from './types';

// The AI instance is now handled by the backend

// Simple unique ID for the device
const getLocalUserId = () => {
  let id = localStorage.getItem('app_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('app_user_id', id);
  }
  return id;
};

export default function App() {
  const [userId] = useState(getLocalUserId());
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingRental, setAnalyzingRental] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [includeMaintenance, setIncludeMaintenance] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<{ id1: string; id2: string }>({ id1: '', id2: '' });

  // Contracts Listener
  useEffect(() => {
    const q = query(collection(db, 'contracts'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contract));
      setContracts(docs);
      if (docs.length > 0 && !selectedContractId) {
        setSelectedContractId(docs[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      setLoading(false);
    });
    return unsubscribe;
  }, [userId, selectedContractId]);

  // Installments Listener
  useEffect(() => {
    if (!selectedContractId) {
      setInstallments([]);
      return;
    }
    const q = query(collection(db, 'contracts', selectedContractId, 'installments'), orderBy('orderIndex', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Installment));
      setInstallments(docs);
    });
    return unsubscribe;
  }, [selectedContractId]);

  const analyzeRentalContract = async (file: File) => {
    if (!currentContract) return;
    setAnalyzingRental(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await fetch('/api/analyze-rental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType: file.type })
      });

      if (!response.ok) throw new Error('API Error');

      const analysis = await response.json();
      await updateRentalStatus('rented', analysis.rentalAmount, analysis.duration);
    } catch (err) {
      console.error("Rental Analysis Error:", err);
      setError("فشل تحليل عقد الإيجار.");
    } finally {
      setAnalyzingRental(false);
    }
  };
  const analyzeContract = async (file: File) => {
    setAnalyzing(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await fetch('/api/analyze-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType: file.type })
      });

      if (!response.ok) throw new Error('API Error');

      const analysis: ContractAnalysis = await response.json();

      // Save to Firestore
      const contractRef = await addDoc(collection(db, 'contracts'), {
        userId: userId,
        title: analysis.title,
        contractDate: analysis.contractDate,
        unitDetails: analysis.unitDetails,
        totalPrice: analysis.totalPrice,
        deliveryDate: analysis.deliveryDate,
        deliveryGracePeriod: analysis.deliveryGracePeriod,
        maintenanceDeposit: analysis.maintenanceDeposit,
        maintenanceDepositDueDate: analysis.maintenanceDepositDueDate,
        maintenanceType: analysis.maintenanceType,
        unitArea: analysis.unitArea,
        rentalAmount: analysis.rentalAmount,
        exchangeRateAtContract: analysis.exchangeRateAtContract,
        usdPriceAtContract: analysis.usdPriceAtContract,
        legalAdvice: analysis.legalAdvice,
        createdAt: new Date().toISOString()
      });

      // Add installments in batch
      const batch = writeBatch(db);
      analysis.installments.forEach((inst, index) => {
        const instRef = doc(collection(db, 'contracts', contractRef.id, 'installments'));
        batch.set(instRef, {
          contractId: contractRef.id,
          amount: inst.amount,
          dueDate: inst.dueDate,
          isPaid: false,
          description: inst.description,
          orderIndex: index
        });
      });
      await batch.commit();

      setSelectedContractId(contractRef.id);
    } catch (err) {
      console.error("Analysis Error:", err);
      setError("فشل تحليل العقد. تأكد من وضوح الصورة وحاول مرة أخرى.");
    } finally {
      setAnalyzing(false);
    }
  };

  const togglePaid = async (installment: Installment) => {
    if (!selectedContractId) return;
    const instRef = doc(db, 'contracts', selectedContractId, 'installments', installment.id);
    await updateDoc(instRef, { isPaid: !installment.isPaid });
  };

  const toggleMaintenancePaid = async () => {
    if (!currentContract || currentContract.maintenanceType === 'integrated') return;
    const contractRef = doc(db, 'contracts', currentContract.id);
    await updateDoc(contractRef, { 
      isMaintenancePaid: !currentContract.isMaintenancePaid,
      lastVacancyDate: (!currentContract.isMaintenancePaid && paidCount === installments.length)
        ? new Date().toISOString() 
        : (currentContract.lastVacancyDate || null)
    });
  };

  const updateRentalStatus = async (status: 'vacant' | 'rented', amount?: number, duration?: string) => {
    if (!currentContract) return;
    const contractRef = doc(db, 'contracts', currentContract.id);
    const updates: any = { 
      rentalStatus: status,
      lastVacancyDate: status === 'vacant' ? new Date().toISOString() : null,
      rentalStartDate: status === 'rented' ? new Date().toISOString() : null
    };
    if (amount !== undefined) updates.rentalAmount = amount;
    if (duration !== undefined) updates.rentalDuration = duration;
    await updateDoc(contractRef, updates);
  };

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleFirestoreError = (error: unknown, operationType: string, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError(`خطأ في العملية (${operationType}): ${errInfo.error}`);
  };

  const deleteContract = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contracts', id));
      if (selectedContractId === id) setSelectedContractId(null);
      setIsDeleting(null);
    } catch (err) {
      handleFirestoreError(err, 'delete', `contracts/${id}`);
    }
  };

  const [rentalAmount, setRentalAmount] = useState<string>('');
  const [rentalDuration, setRentalDuration] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const currentContract = contracts.find(c => c.id === selectedContractId);

  useEffect(() => {
    if (currentContract) {
      setRentalAmount(currentContract.rentalAmount?.toString() || '');
      setRentalDuration(currentContract.rentalDuration || '');
      setNewTitle(currentContract.title);
    }
  }, [currentContract]);

  const handleCompare = async () => {
    if (!compareIds.id1 || !compareIds.id2) return;
    setComparing(true);
    setError(null);

    try {
      const c1 = contracts.find(c => c.id === compareIds.id1);
      const c2 = contracts.find(c => c.id === compareIds.id2);

      if (!c1 || !c2) throw new Error("لم يتم العثور على العقود المختارة.");

      const prompt = `
        أنت محامٍ خبير في القانون المصري. قم بالمقارنة بين العقدين التاليين واستخرج الاختلافات القانونية والمالية الجوهرية بينهما:

        العقد الأول:
        العنوان: ${c1.title}
        التفاصيل: ${c1.unitDetails}
        السعر: ${c1.totalPrice}
        التسليم: ${c1.deliveryDate}
        الصيانة: ${c1.maintenanceDeposit} (${c1.maintenanceType})

        العقد الثاني:
        العنوان: ${c2.title}
        التفاصيل: ${c2.unitDetails}
        السعر: ${c2.totalPrice}
        التسليم: ${c2.deliveryDate}
        الصيانة: ${c2.maintenanceDeposit} (${c2.maintenanceType})

        ركز في مقارنتك على:
        1. فروق السعر الإجمالي وسعر المتر.
        2. مواعيد التسليم وفترات السماح.
        3. بنود الصيانة وطريقة دفعها.
        4. أي ثغرات قانونية في أحدهما دون الآخر.
        5. التوصية النهائية: أيهما أفضل قانونياً ومالياً ولماذا؟

        قدم الإجابة بتنسيق Markdown احترافي ومنظم.
      `;

      const response = await fetch('/api/compare-contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) throw new Error('API Error');

      const result = await response.json();
      setComparisonResult(result.text || "فشلت عملية المقارنة.");
    } catch (err) {
      console.error("Comparison Error:", err);
      setError("حدث خطأ أثناء مقارنة العقود.");
    } finally {
      setComparing(false);
    }
  };

  const updateContractTitle = async () => {
    if (!currentContract || !newTitle.trim()) return;
    try {
      const contractRef = doc(db, 'contracts', currentContract.id);
      await updateDoc(contractRef, { title: newTitle.trim() });
      setEditingTitle(false);
    } catch (err) {
      handleFirestoreError(err, 'update', `contracts/${currentContract.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const paidCount = installments.filter(i => i.isPaid).length;
  const totalInstallmentsAmount = installments.reduce((sum, i) => sum + i.amount, 0);
  const paidAmount = installments.filter(i => i.isPaid).reduce((sum, i) => sum + i.amount, 0);

  const displayTotalPrice = currentContract 
    ? (includeMaintenance 
        ? (currentContract.totalPrice || 0) + (currentContract.maintenanceDeposit || 0)
        : (currentContract.totalPrice || 0))
    : 0;

  const isFullyPaid = currentContract && paidCount === installments.length && (currentContract.maintenanceType === 'integrated' || currentContract.isMaintenancePaid);
  
  const vacancyDays = currentContract?.lastVacancyDate 
    ? Math.floor((new Date().getTime() - new Date(currentContract.lastVacancyDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row text-right overflow-hidden" dir="rtl">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900">عقودي</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-200 flex flex-col h-full z-50 transition-transform duration-300 md:relative md:translate-x-0 md:z-auto",
        sidebarOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">عقودي</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 text-slate-400 hover:text-slate-600 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <button 
            onClick={() => setCompareModalOpen(true)}
            className="w-full p-4 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all mb-4"
          >
            <GitCompare className="w-5 h-5" />
            مقارنة بين عقدين
          </button>

          <label className="block">
            <div className={cn(
              "w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all cursor-pointer flex flex-col items-center gap-2",
              analyzing && "opacity-50 pointer-events-none"
            )}>
              {analyzing ? (
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              ) : (
                <Upload className="w-6 h-6 text-slate-400" />
              )}
              <span className="text-sm font-medium text-slate-600">تحليل عقد جديد</span>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*,application/pdf" 
                onChange={(e) => e.target.files?.[0] && analyzeContract(e.target.files[0])}
              />
            </div>
          </label>

          <div className="pt-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">العقود المحفوظة</h3>
            {contracts.map(contract => (
              <div 
                key={contract.id}
                onClick={() => { setSelectedContractId(contract.id); setSidebarOpen(false); }}
                className={cn(
                  "group relative p-4 rounded-xl cursor-pointer transition-all mb-2",
                  selectedContractId === contract.id 
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                    : "hover:bg-slate-100 text-slate-600"
                )}
              >
                <div className="flex items-center gap-3">
                  <FileText className={cn("w-5 h-5", selectedContractId === contract.id ? "text-indigo-600" : "text-slate-400")} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{contract.title}</p>
                    <p className="text-xs opacity-70">{new Date(contract.createdAt).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsDeleting(contract.id); }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-900 truncate">مستخدم محلي</p>
              <p className="text-xs text-slate-500 truncate">يتم حفظ البيانات على هذا الجهاز</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:h-screen overflow-y-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {selectedContractId && currentContract ? (
            <motion.div 
              key={selectedContractId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              {/* Header Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex-1 min-w-0">
                  {editingTitle ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="text-2xl font-bold text-slate-900 bg-white border border-indigo-200 rounded-xl px-3 py-1 outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
                        autoFocus
                      />
                      <button 
                        onClick={updateContractTitle}
                        className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => { setEditingTitle(false); setNewTitle(currentContract.title); }}
                        className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 group">
                      <h1 className="text-2xl font-bold text-slate-900 truncate">{currentContract.title}</h1>
                      <button 
                        onClick={() => setEditingTitle(true)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="mt-1 space-y-0.5">
                    <p className="text-indigo-600 font-bold text-sm flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      تاريخ التعاقد: {currentContract.contractDate || 'غير محدد'}
                    </p>
                    <p className="text-slate-400 text-xs">تاريخ الإضافة: {new Date(currentContract.createdAt).toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isFullyPaid && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" />
                      خالصة الثمن والوديعة
                    </div>
                  )}
                  <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    <button 
                      onClick={() => setIncludeMaintenance(false)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
                        !includeMaintenance ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      بدون الوديعة
                    </button>
                    <button 
                      onClick={() => setIncludeMaintenance(true)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
                        includeMaintenance ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      مع الوديعة
                    </button>
                  </div>
                  <button 
                    onClick={() => setIsDeleting(currentContract.id)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-100 font-bold"
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Modal */}
              <AnimatePresence>
                {isDeleting && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
                    >
                      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="w-8 h-8 text-red-600" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">تأكيد الحذف</h3>
                      <p className="text-slate-500 mb-8">هل أنت متأكد من رغبتك في حذف هذا العقد؟ لا يمكن التراجع عن هذا الإجراء.</p>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => deleteContract(isDeleting)}
                          className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
                        >
                          نعم، احذف
                        </button>
                        <button 
                          onClick={() => setIsDeleting(null)}
                          className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                          إلغاء
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                  icon={<DollarSign className="text-blue-600" />} 
                  label={includeMaintenance ? "إجمالي العقد + الوديعة" : "إجمالي العقد (الوحدة)"} 
                  value={`${displayTotalPrice.toLocaleString()} ج.م`} 
                  subValue={currentContract.usdPriceAtContract !== undefined ? `≈ ${currentContract.usdPriceAtContract.toLocaleString()} دولار (سعر الصرف: ${currentContract.exchangeRateAtContract})` : undefined}
                  color="blue"
                />
                <StatCard 
                  icon={<Key className="text-emerald-600" />} 
                  label="المبلغ المدفوع" 
                  value={`${paidAmount.toLocaleString()} ج.م`} 
                  color="emerald"
                />
                <StatCard 
                  icon={<Calendar className="text-amber-600" />} 
                  label="الأقساط" 
                  value={`${paidCount} / ${installments.length}`} 
                  color="amber"
                />
                <StatCard 
                  icon={<CheckCircle2 className="text-indigo-600" />} 
                  label="نسبة السداد" 
                  value={`${Math.round((paidAmount / (totalInstallmentsAmount || 1)) * 100)}%`} 
                  color="indigo"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Installments */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        جدول الأقساط
                      </h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {installments.length > 0 ? (
                        installments.map((inst, idx) => (
                          <div 
                            key={inst.id}
                            className={cn(
                              "p-4 flex items-center gap-4 transition-colors hover:bg-slate-50 border-b border-slate-50 last:border-0",
                              inst.isPaid && "bg-emerald-50/30"
                            )}
                          >
                            <div className="text-xs font-bold text-slate-400 w-20 flex-shrink-0">
                              {new Date(inst.dueDate).toLocaleDateString('ar-EG')}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-slate-900 mb-0.5">{inst.amount.toLocaleString()} ج.م</div>
                              <p className="text-xs text-slate-500 truncate">{inst.description}</p>
                            </div>

                            <button 
                              onClick={() => togglePaid(inst)}
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0",
                                inst.isPaid ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200" : "border-2 border-slate-200 text-slate-300 hover:border-emerald-400"
                              )}
                            >
                              {inst.isPaid ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-12 text-center text-slate-400">لا توجد أقساط مسجلة لهذا العقد.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Details & Advice */}
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      تفاصيل التعاقد
                    </h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <DetailItem 
                        icon={MapPin} 
                        label="تفاصيل الوحدة والتعاقد" 
                        value={currentContract.unitDetails} 
                        className="bg-indigo-50/30 border-indigo-100"
                      />
                      <DetailItem 
                        icon={Maximize} 
                        label="مساحة الوحدة" 
                        value={currentContract.unitArea ? `${currentContract.unitArea} متر مربع` : undefined} 
                      />
                      <DetailItem icon={Calendar} label="تاريخ التسليم" value={currentContract.deliveryDate} />
                      <DetailItem icon={Truck} label="مهلة التسليم" value={currentContract.deliveryGracePeriod} />
                      
                      {currentContract.usdPriceAtContract !== undefined && (
                        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 transition-all hover:bg-white hover:shadow-md group min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex-shrink-0">
                              <DollarSign className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">القيمة الدولارية (وقت التعاقد)</span>
                          </div>
                          <div className="flex flex-col pr-2">
                            <span className="text-base font-black text-slate-900">
                              {currentContract.usdPriceAtContract.toLocaleString()} $
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                              سعر الصرف: {currentContract.exchangeRateAtContract} ج.م
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">وديعة الصيانة</span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap pr-2">
                          <button 
                            onClick={toggleMaintenancePaid}
                            disabled={currentContract.maintenanceType === 'integrated'}
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center transition-all shadow-sm flex-shrink-0",
                              currentContract.isMaintenancePaid || currentContract.maintenanceType === 'integrated' ? "bg-emerald-500 text-white" : "border-2 border-slate-200 text-slate-300 hover:border-emerald-400",
                              currentContract.maintenanceType === 'integrated' && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {currentContract.isMaintenancePaid || currentContract.maintenanceType === 'integrated' ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          </button>
                          <span className="text-base font-black text-slate-900 break-words">
                            {currentContract.maintenanceDeposit?.toLocaleString()} ج.م
                            {currentContract.maintenanceType === 'integrated' && (
                              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mr-2 inline-block">مدمجة</span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      <DetailItem icon={Clock} label="استحقاق الوديعة" value={currentContract.maintenanceDepositDueDate} />
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-indigo-600 p-4 text-white flex items-center gap-2">
                      <Scale className="w-5 h-5" />
                      <h3 className="text-lg font-bold">المشورة القانونية</h3>
                    </div>
                    <div className="p-6">
                      <div className="prose prose-slate prose-sm max-w-none leading-relaxed text-slate-600">
                        <ReactMarkdown>{currentContract.legalAdvice || ''}</ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  {/* Rental Management Section */}
                  {isFullyPaid && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                          <Building className="w-5 h-5 text-indigo-600" />
                          إدارة الإيجار
                        </h3>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          currentContract.rentalStatus === 'rented' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {currentContract.rentalStatus === 'rented' ? 'مؤجرة' : 'خالية'}
                        </div>
                      </div>

                      {currentContract.rentalStatus === 'rented' ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-xs text-slate-400 font-bold mb-1">القيمة الإيجارية الشهرية</p>
                              <p className="text-lg font-black text-slate-900">{currentContract.rentalAmount?.toLocaleString()} ج.م</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-xs text-slate-400 font-bold mb-1">مدة الإيجار</p>
                              <p className="text-lg font-black text-slate-900">
                                {currentContract.rentalDuration || '--'}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => updateRentalStatus('vacant')}
                            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                          >
                            <Key className="w-4 h-4" />
                            إنهاء الإيجار / الوحدة خالية
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                              <Clock className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-xs text-amber-600 font-bold">مدة الخلو</p>
                              <p className="text-xl font-black text-amber-900">{vacancyDays} يوم</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <input 
                              type="number" 
                              placeholder="قيمة الإيجار الشهري" 
                              value={rentalAmount}
                              onChange={(e) => setRentalAmount(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-right focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <input 
                              type="text" 
                              placeholder="مدة الإيجار (مثال: سنة واحدة)" 
                              value={rentalDuration}
                              onChange={(e) => setRentalDuration(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-right focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button 
                              onClick={() => updateRentalStatus('rented', Number(rentalAmount), rentalDuration)}
                              disabled={!rentalAmount || !rentalDuration}
                              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                              تأجير الوحدة الآن
                            </button>

                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200"></div>
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-slate-400">أو حلل عقد الإيجار</span>
                              </div>
                            </div>

                            <label className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                              {analyzingRental ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                              <span className="text-sm font-bold text-slate-600">رفع عقد الإيجار</span>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*,application/pdf" 
                                onChange={(e) => e.target.files?.[0] && analyzeRentalContract(e.target.files[0])}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                <FileText className="w-16 h-16 text-slate-300" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">ابدأ بتحليل عقدك الأول</h2>
              <p className="text-slate-500 max-w-md mx-auto mb-8">قم برفع صورة العقد أو ملف PDF ليقوم المحامي الذكي باستخراج الأقساط وتقديم النصيحة القانونية لك.</p>
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 border border-red-100">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              <label className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 cursor-pointer">
                <Upload className="w-5 h-5" />
                رفع العقد للتحليل
                <input 
                  type="file" 
                  className="hidden" 
                  accept="image/*,application/pdf" 
                  onChange={(e) => e.target.files?.[0] && analyzeContract(e.target.files[0])}
                />
              </label>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Comparison Modal */}
      <AnimatePresence>
        {compareModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCompareModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                <div className="flex items-center gap-3">
                  <GitCompare className="w-6 h-6" />
                  <h3 className="text-xl font-bold">مقارنة العقود الذكية</h3>
                </div>
                <button onClick={() => setCompareModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 text-right" dir="rtl">
                {!comparisonResult ? (
                  <div className="space-y-6">
                    <p className="text-slate-500 font-medium">اختر عقدين من القائمة للمقارنة بينهما قانونياً ومالياً:</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">العقد الأول</label>
                        <select 
                          value={compareIds.id1}
                          onChange={(e) => setCompareIds(prev => ({ ...prev, id1: e.target.value }))}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">اختر عقداً...</option>
                          {contracts.map(c => (
                            <option key={c.id} value={c.id} disabled={c.id === compareIds.id2}>{c.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">العقد الثاني</label>
                        <select 
                          value={compareIds.id2}
                          onChange={(e) => setCompareIds(prev => ({ ...prev, id2: e.target.value }))}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">اختر عقداً...</option>
                          {contracts.map(c => (
                            <option key={c.id} value={c.id} disabled={c.id === compareIds.id1}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button 
                      onClick={handleCompare}
                      disabled={comparing || !compareIds.id1 || !compareIds.id2}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-indigo-200"
                    >
                      {comparing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          جاري تحليل الفروق القانونية...
                        </>
                      ) : (
                        <>
                          <GitCompare className="w-5 h-5" />
                          ابدأ المقارنة الآن
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="prose prose-slate prose-indigo max-w-none bg-slate-50 p-6 rounded-2xl border border-slate-100 leading-relaxed">
                      <ReactMarkdown>{comparisonResult}</ReactMarkdown>
                    </div>
                    <button 
                      onClick={() => {
                        setComparisonResult(null);
                        setCompareIds({ id1: '', id2: '' });
                      }}
                      className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                    >
                      مقارنة عقود أخرى
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }: { icon: React.ReactNode, label: string, value: string, subValue?: string, color: string }) {
  const colors = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    amber: "bg-amber-50 border-amber-100",
    indigo: "bg-indigo-50 border-indigo-100",
  };

  return (
    <div className={cn("p-5 rounded-3xl border shadow-sm", colors[color as keyof typeof colors])}>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-white rounded-xl shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-bold text-slate-600">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-900 leading-tight">{value}</div>
      {subValue && <div className="text-[11px] font-bold text-indigo-600 mt-1.5 bg-indigo-50/50 px-2 py-0.5 rounded-lg inline-block">{subValue}</div>}
    </div>
  );
}

function DetailItem({ label, value, icon: Icon, className }: { label: string, value?: string | number, icon?: any, className?: string }) {
  return (
    <div className={cn(
      "p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group min-w-0",
      className
    )}>
      <div className="flex items-center gap-3 mb-2">
        {Icon && (
          <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-base text-slate-900 font-black leading-relaxed break-words pr-2">
        {value || 'غير متوفر'}
      </p>
    </div>
  );
}
