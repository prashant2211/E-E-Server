const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthKey = (date) => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key) => {
  const [year, month] = String(key || '').split('-');
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : String(key || '');
};

const monthsThrough = (startDate, endDate) => {
  const start = monthKey(startDate);
  const end = monthKey(endDate);
  if (!start || !end || start > end) return [];
  const out = [];
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
};

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const buildBoarderLedger = (allocation, payments, today = new Date()) => {
  const monthlyFee = roundMoney(allocation.Monthly_Fee);
  const start = allocation.Allocation_Date || allocation.createdAt || today;
  const released = allocation.Status === 'Released' && allocation.Release_Date
    ? new Date(allocation.Release_Date)
    : null;
  const end = released && released < today ? released : today;
  const current = monthKey(today);
  const paidByMonth = {};
  payments.forEach((payment) => {
    (payment.Months || []).forEach((line) => {
      if (!line?.Month) return;
      paidByMonth[line.Month] = roundMoney((paidByMonth[line.Month] || 0) + Number(line.Amount || 0));
    });
  });
  const months = monthsThrough(start, end).map((month) => {
    const due = monthlyFee;
    const paid = roundMoney(Math.min(due, paidByMonth[month] || 0));
    return {
      month,
      label: monthLabel(month),
      due,
      paid,
      balance: roundMoney(Math.max(0, due - paid)),
    };
  });
  const arrears = roundMoney(months.filter((row) => row.month < current).reduce((sum, row) => sum + row.balance, 0));
  const currentRow = months.find((row) => row.month === current);
  const currentDue = roundMoney(currentRow?.balance || 0);
  const totalDue = roundMoney(months.reduce((sum, row) => sum + row.due, 0));
  const totalPaid = roundMoney(months.reduce((sum, row) => sum + row.paid, 0));
  const room = allocation.Room_Id && typeof allocation.Room_Id === 'object' ? allocation.Room_Id : {};
  return {
    allocationId: String(allocation._id),
    registrationNumber: allocation.Registration_Number || '',
    studentName: allocation.Student_Name || allocation.Registration_Number || '',
    className: allocation.Class || '',
    section: allocation.Section || '',
    hostelName: room.Hostel_Name || '',
    roomNumber: room.Room_Number || '',
    bedNumber: allocation.Bed_Number,
    status: allocation.Status || '',
    monthlyFee,
    months,
    arrears,
    currentDue,
    totalDue,
    totalPaid,
    balance: roundMoney(arrears + currentDue),
  };
};

module.exports = {
  monthKey,
  monthLabel,
  buildBoarderLedger,
  roundMoney,
};
