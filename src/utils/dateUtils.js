import db from '../pouchdb';

// Get POS date from settings and combine it with current time
export const getPOSDateTime = async () => {
  try {
    const result = await db.query('pos_index/pos_settings_by_all', {
      reduce: false,
      descending: true,
      limit: 1,
    });

    if (result.rows.length > 0) {
      const settings = result.rows[0].value;
      const posDate = settings.pos_date;
      const currentTime = new Date().toTimeString().split(' ')[0];
      return `${posDate}T${currentTime}`;
    }

    return new Date().toISOString(); // Fallback to real date if no POS date is set
  } catch (error) {
    console.error('Error getting POS date:', error);
    return new Date().toISOString(); // Fallback to real date if error occurs
  }
};

// Format for display
export const formatPOSDate = (dateString) => {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(dateString).toLocaleDateString('ar-EG', options);
};
