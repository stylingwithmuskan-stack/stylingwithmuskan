
import React, { useState, useEffect } from 'react';
import { api } from "@/modules/user/lib/api";

const SubscriptionPage = () => {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.subscriptions.getPlans();
        setPlans(response.plans.filter(p => p.userType === 'customer'));
      } catch (error) {
        console.error("Failed to fetch subscription plans", error);
      }
    };

    fetchPlans();
  }, []);

  const handleSubscribe = async (planId) => {
    try {
      // In a real app, you would get the userId from your auth context
      const userId = 'customer123'; 
      const response = await api.subscriptions.subscribe({ planId, userId, userType: 'customer' });
      // Here you would redirect to the payment gateway using the order details
      // from the response.
      console.log('Subscription order created:', response.order);
      alert(`Redirecting to payment gateway for plan ${planId}`)
    } catch (error) {
      console.error("Failed to subscribe", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">SWM Plus Subscription</h1>
      <div className="grid md:grid-cols-2 gap-8">
        {plans.map((plan) => (
          <div key={plan.planId} className="border p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">{plan.name}</h2>
            <p className="text-xl font-semibold mb-4">₹{plan.price}</p>
            <ul className="list-disc list-inside mb-6">
              {plan.benefits.map((benefit, index) => (
                <li key={index}>{benefit.replace(/_/g, ' ')}</li>
              ))}
            </ul>
            <button 
              onClick={() => handleSubscribe(plan.planId)}
              className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700"
            >
              Subscribe Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionPage;
