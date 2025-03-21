import db from '../pouchdb';

export const checkShiftStatus = async (userId, terminalId) => {
  try {
    // Check for regular shifts on this terminal and for this user
    const shiftResult = await db.find({
      selector: {
        document_type: 'shift',
        type: 'shift',
        terminal_id: terminalId,
        user_id: userId,
        is_closed: false,
      },
    });

    // Check for opening balance shifts for this terminal
    const openingBalanceResult = await db.find({
      selector: {
        document_type: 'shift',
        type: 'opening_balance',
        terminal_id: terminalId,
        is_closed: false,
      },
    });

    // If there's an active shift on this terminal
    if (shiftResult.docs.length > 0) {
      // Only allow the user who owns the shift
      if (shiftResult.docs[0].user_id !== userId) {
        return {
          allowed: false,
          message: 'هناك مستخدم آخر لديه وردية نشطة على نقطة البيع هذه',
        };
      }
      return {
        allowed: true,
        shiftId: shiftResult.docs[0]._id,
      };
    }

    // If there's an opening balance for this user
    if (openingBalanceResult.docs.length > 0) {
      return {
        allowed: true,
        shiftId: openingBalanceResult.docs[0]._id,
      };
    }

    // No active shifts or opening balances found - prevent login
    return {
      allowed: false,
      message: 'لا توجد وردية أو رصيد افتتاحي متاحة لنقطة البيع هذه',
    };
  } catch (error) {
    console.error('Error checking shift status:', error);
    return {
      allowed: false,
      message: 'حدث خطأ أثناء التحقق من حالة الوردية',
    };
  }
};
