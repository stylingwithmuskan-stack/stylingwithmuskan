import React, { useState, useEffect } from 'react';
import { api } from '@/modules/user/lib/api';
import { motion } from 'framer-motion';
import { MapPin, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ZoneRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, all
  const [zoneTypeFilter, setZoneTypeFilter] = useState('all'); // all, new, existing
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { requests: data } = await api.vendor.listZoneRequests();
      setRequests(data || []);
    } catch (error) {
      console.error('Failed to fetch zone requests:', error);
      toast.error('Failed to load zone requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    if (!confirm(`Approve zone request for "${request.zoneName}"?`)) return;
    
    try {
      setProcessing(true);
      await api.vendor.updateSPStatus(request.providerId, 'approved');
      await api.vendor.approveSPZones(request.providerId);
      toast.success(request.isNewZone 
        ? 'Request approved and forwarded to admin for zone creation' 
        : 'Zone access granted to provider'
      );
      fetchRequests();
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error('Failed to approve request');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    try {
      setProcessing(true);
      await api.vendor.rejectSPZones(selectedRequest.providerId, { 
        reason: rejectionReason || 'Rejected by vendor' 
      });
      toast.success('Request rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error('Failed to reject request');
    } finally {
      setProcessing(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    // Status filter
    if (filter === 'pending' && req.vendorStatus !== 'pending') return false;
    if (filter === 'approved' && req.vendorStatus !== 'approved') return false;
    if (filter === 'rejected' && req.vendorStatus !== 'rejected') return false;
    
    // Zone type filter
    if (zoneTypeFilter === 'new' && !req.isNewZone) return false;
    if (zoneTypeFilter === 'existing' && req.isNewZone) return false;
    
    return true;
  });

  const pendingCount = requests.filter(r => r.vendorStatus === 'pending').length;
  const approvedCount = requests.filter(r => r.vendorStatus === 'approved').length;
  const rejectedCount = requests.filter(r => r.vendorStatus === 'rejected').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Zone Requests</h1>
        <p className="text-gray-600">Manage provider zone access requests</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approved ({approvedCount})
            </button>
            <button
              onClick={() => setFilter('rejected')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejected ({rejectedCount})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({requests.length})
            </button>
          </div>

          {/* Zone Type Filter */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setZoneTypeFilter('all')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                zoneTypeFilter === 'all'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Zones
            </button>
            <button
              onClick={() => setZoneTypeFilter('new')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                zoneTypeFilter === 'new'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🆕 New Zones Only
            </button>
            <button
              onClick={() => setZoneTypeFilter('existing')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                zoneTypeFilter === 'existing'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Existing Zones
            </button>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No zone requests found</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <motion.div
              key={request._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Zone Name with Badge */}
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-bold text-gray-900">
                      {request.zoneName}
                    </h3>
                    {request.isNewZone && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full">
                        🆕 NEW ZONE
                      </span>
                    )}
                    {request.vendorStatus === 'approved' && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded-full flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Approved
                      </span>
                    )}
                    {request.vendorStatus === 'rejected' && (
                      <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded-full flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        Rejected
                      </span>
                    )}
                  </div>

                  {/* Provider Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Provider</p>
                      <p className="font-medium text-gray-900">{request.providerName}</p>
                      <p className="text-sm text-gray-600">{request.providerPhone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="text-sm text-gray-900">{request.providerAddress || 'Not provided'}</p>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>
                      Requested {new Date(request.requestedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Rejection Reason */}
                  {request.rejectionReason && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">
                        <strong>Rejection Reason:</strong> {request.rejectionReason}
                      </p>
                    </div>
                  )}

                  {/* Admin Status for New Zones */}
                  {request.isNewZone && request.vendorStatus === 'approved' && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>Admin Status:</strong> {request.adminStatus === 'pending' ? 'Waiting for admin to create zone' : request.adminStatus}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {request.vendorStatus === 'pending' && (
                  <div className="flex flex-col gap-2 ml-4">
                    {request.isNewZone && request.providerLocation?.lat && (
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowLocationModal(true);
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm"
                      >
                        <MapPin className="w-4 h-4" />
                        View Location
                      </button>
                    )}
                    <button
                      onClick={() => handleApprove(request)}
                      disabled={processing}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {request.isNewZone ? 'Approve & Forward' : 'Approve'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowRejectModal(true);
                      }}
                      disabled={processing}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Location Modal */}
      {showLocationModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Provider Location - {selectedRequest.providerName}
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Address:</strong> {selectedRequest.providerAddress}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Coordinates:</strong> {selectedRequest.providerLocation?.lat}, {selectedRequest.providerLocation?.lng}
              </p>
            </div>

            <div className="bg-gray-100 rounded-lg p-8 text-center mb-4">
              <MapPin className="w-16 h-16 text-pink-500 mx-auto mb-2" />
              <p className="text-gray-600">
                Map integration coming soon
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Location: {selectedRequest.providerLocation?.lat}, {selectedRequest.providerLocation?.lng}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> This location will be shared with admin for zone boundary creation.
              </p>
            </div>

            <button
              onClick={() => {
                setShowLocationModal(false);
                setSelectedRequest(null);
              }}
              className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Reject Zone Request
            </h3>
            
            <p className="text-gray-600 mb-4">
              Are you sure you want to reject the zone request for <strong>{selectedRequest.zoneName}</strong> by <strong>{selectedRequest.providerName}</strong>?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection (Optional)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                rows="3"
                placeholder="Enter reason for rejection..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {processing ? 'Rejecting...' : 'Reject Request'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectionReason('');
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
