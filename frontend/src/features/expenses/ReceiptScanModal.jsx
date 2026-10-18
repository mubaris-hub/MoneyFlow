import React, { useState, useEffect, useRef } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import receiptService from '../../services/receipt.service';
import expenseService from '../../services/expense.service';
import groupService from '../../services/group.service';
import useAuth from '../../hooks/useAuth';
import {
  Upload,
  ScanLine,
  FileText,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Calendar,
  IndianRupee,
  Store,
  X,
  ChevronDown,
  ChevronUp,
  Info,
  RotateCcw,
  Sparkles,
  Users,
  User,
  Tag,
  Check
} from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export const ReceiptScanModal = ({ isOpen, onClose, onExpenseSaved, initialGroupId }) => {
  const { user } = useAuth();

  // OCR Upload & Scanner State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [showRawText, setShowRawText] = useState(false);

  // Review Form State
  const [merchantName, setMerchantName] = useState('');
  const [date, setDate] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [lineItems, setLineItems] = useState([]);
  const [fieldStatus, setFieldStatus] = useState({});

  // Smart Category Suggestion State
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [suggestedCategory, setSuggestedCategory] = useState(null);
  const [isCategoryOverridden, setIsCategoryOverridden] = useState(false);

  // Group & Expense Saving State
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || '');
  const [groupMembers, setGroupMembers] = useState([]);
  const [paidById, setPaidById] = useState('');
  const [notes, setNotes] = useState('');

  // Saving lifecycle & duplicate prevention
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedExpense, setSavedExpense] = useState(null);
  const hasSubmittedRef = useRef(false);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  // Fetch categories and groups on open
  useEffect(() => {
    if (isOpen) {
      expenseService
        .getCategories()
        .then((cats) => {
          setCategories(cats || []);
        })
        .catch(console.error);

      groupService
        .getGroups()
        .then((grps) => {
          setGroups(grps || []);
          if (initialGroupId) {
            setSelectedGroupId(initialGroupId);
          } else if (grps && grps.length > 0 && !selectedGroupId) {
            setSelectedGroupId(grps[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, initialGroupId]);

  // Fetch group members when group changes
  useEffect(() => {
    if (selectedGroupId) {
      groupService
        .getGroup(selectedGroupId)
        .then((grp) => {
          const members = grp.members || [];
          setGroupMembers(members);
          if (members.length > 0) {
            const isUserMember = members.some((m) => m.user.id === user?.id);
            setPaidById(isUserMember ? user.id : members[0].user.id);
          }
        })
        .catch(console.error);
    }
  }, [selectedGroupId, user]);

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setScanning(false);
    setError(null);
    setScanResult(null);
    setShowRawText(false);
    setMerchantName('');
    setDate('');
    setTotalAmount('');
    setCurrency('INR');
    setLineItems([]);
    setFieldStatus({});
    setCategoryId('');
    setSuggestedCategory(null);
    setIsCategoryOverridden(false);
    setNotes('');
    setIsSaving(false);
    setSaveSuccess(false);
    setSavedExpense(null);
    hasSubmittedRef.current = false;
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError('File size exceeds the 5 MB limit. Please choose a smaller image.');
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setError('Unsupported file type. Please upload a JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleScan = async () => {
    if (!selectedFile) {
      setError('Please select a receipt image to scan.');
      return;
    }

    setScanning(true);
    setError(null);

    try {
      const response = await receiptService.scanReceipt(selectedFile);
      if (response && response.success && response.extracted_data) {
        const data = response.extracted_data;
        setScanResult(data);
        setMerchantName(data.merchant_name || '');
        setDate(data.date || new Date().toISOString().split('T')[0]);
        setTotalAmount(data.total_amount || '');
        setCurrency(data.currency || 'INR');
        setLineItems(data.line_items || []);
        setFieldStatus(data.field_status || {});

        // Process Category Suggestion
        if (data.suggested_category) {
          setSuggestedCategory(data.suggested_category);
          setIsCategoryOverridden(false);
          if (data.suggested_category.category_id) {
            setCategoryId(String(data.suggested_category.category_id));
          } else if (categories.length > 0) {
            const matchedCat = categories.find(
              (c) => c.name.toLowerCase() === data.suggested_category.category_name.toLowerCase()
            );
            if (matchedCat) {
              setCategoryId(String(matchedCat.id));
            } else {
              setCategoryId(String(categories[0].id));
            }
          }
        } else if (categories.length > 0) {
          setSuggestedCategory(null);
          setIsCategoryOverridden(false);
          setCategoryId(String(categories[0].id));
        }
      } else {
        setError('Unexpected response from OCR scanner.');
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.message || 'Failed to scan receipt image.';
      setError(msg);
    } finally {
      setScanning(false);
    }
  };

  // Line item manipulation
  const handleItemChange = (index, field, value) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddItem = () => {
    setLineItems((prev) => [...prev, { description: '', quantity: 1, amount: '' }]);
  };

  const handleRemoveItem = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const itemsSubtotal = lineItems.reduce((acc, item) => {
    const val = parseFloat(item.amount);
    return isNaN(val) ? acc : acc + val;
  }, 0);

  // Handle Category Override
  const handleCategoryChange = (newCatId) => {
    setCategoryId(newCatId);
    if (suggestedCategory && String(suggestedCategory.category_id) !== String(newCatId)) {
      setIsCategoryOverridden(true);
    } else {
      setIsCategoryOverridden(false);
    }
  };

  // Phase 6.4: Confirm and Save Expense
  const handleConfirmAndSave = async (e) => {
    e.preventDefault();

    if (hasSubmittedRef.current || isSaving) {
      return;
    }

    if (!merchantName.trim()) {
      setError('Expense description / merchant name is required.');
      return;
    }

    const numAmount = parseFloat(totalAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid total amount greater than zero.');
      return;
    }

    if (!selectedGroupId) {
      setError('Please select a group to assign this expense.');
      return;
    }

    if (!categoryId) {
      setError('Please select an expense category.');
      return;
    }

    if (!date) {
      setError('Please select a valid date.');
      return;
    }

    if (groupMembers.length === 0) {
      setError('The selected group has no active members to split this expense.');
      return;
    }

    setIsSaving(true);
    hasSubmittedRef.current = true;
    setError(null);

    try {
      // Build notes string including line item details if available
      let combinedNotes = notes ? notes.trim() : '';
      if (lineItems.length > 0) {
        const itemSummaries = lineItems
          .filter((it) => it.description && it.amount)
          .map((it) => `${it.description} (${it.quantity || 1}x ${currency} ${it.amount})`)
          .join(', ');
        if (itemSummaries) {
          combinedNotes = combinedNotes
            ? `${combinedNotes} | Receipt items: ${itemSummaries}`
            : `Receipt items: ${itemSummaries}`;
        }
      }

      // Equal splits payload across all group members
      const splitsPayload = groupMembers.map((m) => ({
        user_id: m.user.id
      }));

      const payload = {
        description: merchantName.trim(),
        total_amount: numAmount.toFixed(2),
        currency: currency,
        group_id: selectedGroupId,
        category_id: Number(categoryId),
        paid_by_id: paidById || user?.id,
        split_type: 'EQUAL',
        date: date,
        notes: combinedNotes,
        splits: splitsPayload
      };

      const created = await expenseService.createExpense(payload);
      setSavedExpense(created);
      setSaveSuccess(true);
      if (onExpenseSaved) {
        onExpenseSaved(created);
      }
    } catch (err) {
      console.error(err);
      hasSubmittedRef.current = false;
      const errData = err.response?.data;
      const msg =
        errData?.detail ||
        errData?.total_amount?.[0] ||
        errData?.description?.[0] ||
        errData?.category_id?.[0] ||
        errData?.splits?.[0] ||
        err.message ||
        'Failed to save expense.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid =
    merchantName.trim().length > 0 &&
    Boolean(totalAmount) &&
    parseFloat(totalAmount) > 0 &&
    Boolean(selectedGroupId) &&
    Boolean(categoryId) &&
    Boolean(date);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <span className="text-base font-bold text-slate-900">Receipt OCR Scanner</span>
            <p className="text-xs text-slate-500 font-normal">
              Extract receipt data, review smart suggestions, and confirm & save expense
            </p>
          </div>
        </div>
      }
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Error notification banner */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success confirmation state */}
        {saveSuccess && savedExpense ? (
          <div className="space-y-5 py-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Expense Recorded Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Your scanned receipt expense has been verified and saved into group accounts.
              </p>
            </div>

            <Card className="max-w-md mx-auto p-4 text-left border border-emerald-100 bg-emerald-50/30 space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                <span className="text-slate-500">Merchant / Description</span>
                <span className="font-bold text-slate-900">{savedExpense.description}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                <span className="text-slate-500">Total Amount</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {savedExpense.currency} {savedExpense.total_amount}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-800">{savedExpense.date}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-100">
                <span className="text-slate-500">Category</span>
                <Badge variant="neutral">{savedExpense.category?.name || 'General'}</Badge>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Assigned Group</span>
                <span className="font-semibold text-slate-800">
                  {groups.find((g) => g.id === selectedGroupId)?.name || 'Group'}
                </span>
              </div>
            </Card>

            <div className="flex items-center justify-center space-x-3 pt-3">
              <Button variant="secondary" onClick={handleReset} className="text-xs">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Scan Another Receipt
              </Button>
              <Button variant="primary" onClick={onClose} className="text-xs px-6">
                Done
              </Button>
            </div>
          </div>
        ) : !scanResult ? (
          /* Phase 1: Upload / Dropzone (When not scanned yet) */
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                selectedFile
                  ? 'border-emerald-400 bg-emerald-50/20'
                  : 'border-slate-300 hover:border-emerald-500 bg-slate-50/50'
              }`}
            >
              <input
                type="file"
                id="receipt-file-input"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
              />

              {previewUrl ? (
                <div className="space-y-3">
                  <div className="max-h-64 flex justify-center overflow-hidden rounded-xl bg-slate-900/5 p-2">
                    <img
                      src={previewUrl}
                      alt="Receipt Preview"
                      className="max-h-60 object-contain rounded-lg shadow-xs"
                    />
                  </div>
                  <div className="flex items-center justify-center space-x-3 text-xs text-slate-600">
                    <span className="font-semibold">{selectedFile?.name}</span>
                    <span>({(selectedFile?.size / 1024 / 1024).toFixed(2)} MB)</span>
                    <label
                      htmlFor="receipt-file-input"
                      className="text-emerald-600 hover:underline cursor-pointer font-medium"
                    >
                      Change image
                    </label>
                  </div>
                </div>
              ) : (
                <label htmlFor="receipt-file-input" className="cursor-pointer block space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Click to upload or drag & drop receipt
                  </p>
                  <p className="text-xs text-slate-500">
                    Supported: JPG, JPEG, PNG, WEBP (Maximum size 5 MB)
                  </p>
                </label>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <Button variant="secondary" onClick={onClose} disabled={scanning}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleScan}
                disabled={!selectedFile || scanning}
                className="min-w-32"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning OCR...
                  </>
                ) : (
                  <>
                    <ScanLine className="w-4 h-4 mr-1.5" /> Scan Receipt
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* Phase 2: Editable Review Form & Phase 6.4: Confirm and Save */
          <div className="space-y-4">
            {/* Informational Banner */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <span className="font-semibold">Review & Verify Extracted Fields:</span> No transaction
                has been recorded yet. Please review all fields, check smart category suggestions, select
                your group, and click <span className="font-semibold">Confirm & Save Expense</span> below.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column: Image Preview & Raw OCR Output */}
              <div className="md:col-span-5 space-y-3">
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex flex-col">
                  <div className="p-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                    <span>Uploaded Receipt</span>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-medium flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Scan Another</span>
                    </button>
                  </div>
                  <div className="max-h-96 overflow-auto p-2 flex items-center justify-center bg-slate-950/5 dark:bg-slate-950/30">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Receipt"
                        className="max-h-88 object-contain rounded-lg shadow-sm"
                      />
                    )}
                  </div>
                </div>

                {/* Raw OCR Text Collapsible */}
                {scanResult.raw_text && (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 flex items-center justify-between font-medium text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center space-x-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>View Raw OCR Output</span>
                      </span>
                      {showRawText ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showRawText && (
                      <pre className="p-3 bg-slate-900 text-slate-200 text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {scanResult.raw_text}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Editable Review & Save Form */}
              <form onSubmit={handleConfirmAndSave} className="md:col-span-7 space-y-4">
                {/* Merchant Name / Description */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <Store className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Merchant / Vendor Name *</span>
                    </label>
                    <Badge
                      variant={fieldStatus.merchant_name === 'detected' ? 'success' : 'neutral'}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {fieldStatus.merchant_name === 'detected' ? 'Detected' : 'Unknown / Review'}
                    </Badge>
                  </div>
                  <Input
                    placeholder="e.g. Eranad Knowledge City, Blue Tokai..."
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    className="text-xs font-medium"
                    required
                  />
                </div>

                {/* Date & Currency Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Date */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Receipt Date *</span>
                      </label>
                      <Badge
                        variant={fieldStatus.date === 'detected' ? 'success' : 'neutral'}
                        className="text-[10px] py-0 px-1.5"
                      >
                        {fieldStatus.date === 'detected' ? 'Detected' : 'Review'}
                      </Badge>
                    </div>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="text-xs font-medium"
                      required
                    />
                  </div>

                  {/* Currency */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Currency</label>
                      <Badge
                        variant={fieldStatus.currency === 'detected' ? 'success' : 'neutral'}
                        className="text-[10px] py-0 px-1.5"
                      >
                        {fieldStatus.currency === 'detected' ? 'Detected' : 'Default'}
                      </Badge>
                    </div>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 font-medium"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                {/* Total Amount */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
                      <IndianRupee className="w-3.5 h-3.5 text-slate-500" />
                      <span>Total Amount *</span>
                    </label>
                    <Badge
                      variant={fieldStatus.total_amount === 'detected' ? 'success' : 'neutral'}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {fieldStatus.total_amount === 'detected' ? 'Detected' : 'Required / Enter Amount'}
                    </Badge>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter amount (e.g. 2625.00)"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="text-xs font-semibold text-slate-900"
                    required
                  />
                  {!totalAmount && (
                    <p className="text-[11px] text-amber-600 font-medium flex items-center space-x-1 mt-0.5">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>Total amount was not extracted. Please enter verified receipt amount.</span>
                    </p>
                  )}
                </div>

                {/* Phase 6.3: Smart Category Suggestion */}
                <div className="space-y-1.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-500" />
                      <span>Expense Category *</span>
                    </label>

                    {suggestedCategory && !isCategoryOverridden ? (
                      <Badge variant="success" className="text-[10px] py-0 px-2 flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-emerald-600 mr-0.5" />
                        <span>Suggested: {suggestedCategory.category_name}</span>
                      </Badge>
                    ) : isCategoryOverridden ? (
                      <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                        Manual Override
                      </Badge>
                    ) : (
                      <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                        Manual Selection
                      </Badge>
                    )}
                  </div>

                  {suggestedCategory && (
                    <p className="text-[11px] text-emerald-700 font-normal">
                      ✨ {suggestedCategory.reason}. You can override by selecting any category below.
                    </p>
                  )}

                  <select
                    value={categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 font-medium"
                    required
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Group & Paid By Selection */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Group Selection */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Group *</span>
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 font-medium"
                      required
                    >
                      <option value="">Select Group...</option>
                      {groups.map((grp) => (
                        <option key={grp.id} value={grp.id}>
                          {grp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Paid By Selection */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>Paid By *</span>
                    </label>
                    <select
                      value={paidById}
                      onChange={(e) => setPaidById(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 font-medium"
                      required
                    >
                      {groupMembers.map((m) => (
                        <option key={m.user.id} value={m.user.id}>
                          {m.user.first_name || m.user.username}{' '}
                          {m.user.id === user?.id ? '(You)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Extracted Line Items Section */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Receipt Line Items</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                        ({lineItems.length} {lineItems.length === 1 ? 'item' : 'items'})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItem}
                      className="h-7 text-xs px-2"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Item
                    </Button>
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-[11px] text-slate-500 dark:text-slate-400">
                      No distinct line items detected. Single-payment receipt or total-only bill.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {lineItems.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <input
                            type="text"
                            placeholder="Description (e.g. EXAM FEE)"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            className="flex-1 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 text-xs"
                          />
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={item.quantity || 1}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-12 px-1 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 text-xs text-center"
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Amount"
                            value={item.amount}
                            onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                            className="w-20 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-900 dark:text-slate-100 text-xs text-right font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {lineItems.length > 0 && (
                    <div className="flex justify-between items-center text-[11px] text-slate-500 px-1 pt-0.5">
                      <span>Line items subtotal:</span>
                      <span className="font-semibold text-slate-800">
                        {currency} {itemsSubtotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes Input */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Optional Notes</label>
                  <input
                    type="text"
                    placeholder="Additional context or notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full py-1.5 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {/* Phase 6.4: Explicit Review & Save Button Area */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <Button type="button" variant="secondary" onClick={handleReset} className="text-xs">
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset & Scan Another
                  </Button>

                  <div className="flex items-center space-x-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="text-xs">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!isFormValid || isSaving}
                      className="min-w-44 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Expense...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-1.5" /> Confirm & Save Expense
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default ReceiptScanModal;
