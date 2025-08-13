import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | SiteMatcher',
  description: 'Privacy Policy for SiteMatcher - Learn how we collect, use, and protect your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-3xl font-bold mb-8 text-center">Privacy Policy</h1>
          <p className="text-gray-600 text-center mb-8">Last updated: August 12, 2025</p>
          
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
              <p className="mb-4">
                This Privacy Notice for SITEMATCHER LTD (doing business as SiteMatcher) describes how and why we might 
                access, collect, store, use, and/or share your personal information when you use our services.
              </p>
              <p className="mb-4">We collect information when you:</p>
              <ul className="list-disc pl-6 mb-4">
                <li>Visit our website at <a href="https://sitematcher.co.uk" className="text-blue-600 hover:underline">https://sitematcher.co.uk</a></li>
                <li>Use our directory site where commercial occupiers and developers can list their site requirements</li>
                <li>Engage with us in sales, marketing, or events</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
              <p className="mb-4">
                We process your personal information for a variety of reasons, depending on how you interact with our Services, including:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>To facilitate account creation and authentication</li>
                <li>To deliver and facilitate delivery of services to the user</li>
                <li>To respond to user inquiries/offer support to users</li>
                <li>To send administrative information to you</li>
                <li>To fulfill and manage your orders</li>
                <li>To enable user-to-user communications</li>
                <li>To request feedback</li>
                <li>To send you marketing and promotional communications</li>
                <li>To deliver targeted advertising to you</li>
                <li>To protect our Services</li>
                <li>To identify usage trends</li>
                <li>To determine the effectiveness of our promotional campaigns</li>
                <li>To save or protect an individual's vital interest</li>
                <li>To comply with our legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
              <p className="mb-4">
                We may process or share your data that we hold based on the following legal basis:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li><strong>Consent:</strong> We may process your data if you have given us specific consent to use your personal information for a specific purpose.</li>
                <li><strong>Legitimate Interests:</strong> We may process your data when it is reasonably necessary to achieve our legitimate business interests.</li>
                <li><strong>Performance of a Contract:</strong> Where we have entered into a contract with you, we may process your personal information to fulfill the terms of our contract.</li>
                <li><strong>Legal Obligations:</strong> We may disclose your information where we are legally required to do so in order to comply with applicable law, governmental requests, a judicial proceeding, court order, or legal process.</li>
                <li><strong>Vital Interests:</strong> We may disclose your information where we believe it is necessary to investigate, prevent, or take action regarding potential violations of our policies, suspected fraud, situations involving potential threats to the safety of any person and illegal activities, or as evidence in litigation in which we are involved.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Data Retention</h2>
              <p className="mb-4">
                We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, 
                unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
              <p className="mb-4">
                We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security 
                of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic 
                transmission over the Internet or information storage technology can be guaranteed to be 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Your Privacy Rights</h2>
              <p className="mb-4">
                In some regions (like the EEA, UK, and Switzerland), you have certain rights under applicable data protection laws. These may include the right to:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Request access and obtain a copy of your personal information</li>
                <li>Request rectification or erasure</li>
                <li>Restrict the processing of your personal information</li>
                <li>Data portability</li>
                <li>Not be subject to automated decision-making</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking Technologies</h2>
              <p className="mb-4">
                We may use cookies and similar tracking technologies (like web beacons and pixels) to access or store information. 
                Specific information about how we use such technologies and how you can refuse certain cookies is set out in our Cookie Notice.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Third-Party Services</h2>
              <p className="mb-4">
                We may use third-party service providers to help us provide our Services. These third parties may have access to your 
                personal information only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
              <p className="mb-4">
                Your information, including personal data, may be transferred to and maintained on computers located outside of your state, 
                province, country, or other governmental jurisdiction where the data protection laws may differ than those from your jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
              <p className="mb-4">
                We do not knowingly solicit data from or market to children under 18 years of age. If we learn that personal information from users less than 18 years of age has been collected, we will deactivate the account and take reasonable measures to promptly delete such data from our records.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Updates to This Policy</h2>
              <p className="mb-4">
                We may update this Privacy Notice from time to time. The updated version will be indicated by an updated "Revised" date and the updated version will be effective as soon as it is accessible.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
              <p className="mb-4">
                If you have questions or comments about this notice, you may contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>SITEMATCHER LTD</strong></p>
                <p>124 City Road</p>
                <p>London, England EC1V 2NX</p>
                <p>England</p>
                <p>Email: <a href="mailto:dovet@live.com" className="text-blue-600 hover:underline">dovet@live.com</a></p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">13. Data Subject Access Requests</h2>
              <p className="mb-4">
                Based on the applicable laws of your country, you may have the right to request access to the personal information we collect from you, 
                details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to 
                withdraw your consent to our processing of your personal information.
              </p>
              <p className="mb-4">
                To request to review, update, or delete your personal information, please contact us using the information provided above.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-gray-200 text-center">
              <p className="text-gray-600">
                <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy rights and choices. 
                We are responsible for making decisions about how your personal information is processed. If you do not agree with our 
                policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at dovet@live.com.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}