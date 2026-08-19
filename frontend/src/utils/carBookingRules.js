export function getCarBookingFormRule({ serviceType, distanceKm, requesterType, withDriver = true }) {
  const isOutOfTown = serviceType === "luar_kota";
  const numericDistance = Number(distanceKm || 0);
  const requiresCitySelfDriveProIn = serviceType === "dalam_kota" && !withDriver;
  const requiresGuestSelfDriveProIn = requesterType === "karyawan_tamu_lepas_kunci";
  const requiresLongDistanceProIn = isOutOfTown && numericDistance >= 60;

  return {
    showDistance: isOutOfTown,
    requireDistance: isOutOfTown,
    showProIn: requiresLongDistanceProIn || requiresCitySelfDriveProIn || requiresGuestSelfDriveProIn,
    requireProIn: requiresLongDistanceProIn || requiresCitySelfDriveProIn || requiresGuestSelfDriveProIn,
    requireDeptHeadApproval: !requiresLongDistanceProIn,
  };
}

export function vehicleServiceLabel(booking = {}) {
  if (booking.service_type === "dalam_kota") return "Dalam Kota";
  if (booking.service_type === "luar_kota") return "Luar Kota";
  return booking.booking_type === "multi_day" ? "Multi-day" : "Single trip";
}
