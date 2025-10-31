"""
SendGrid Email Service for TrainSmart
Handles all transactional email sending
"""
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
from typing import Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EmailDeliveryError(Exception):
    """Custom exception for email delivery failures"""
    pass


class EmailService:
    """SendGrid email service wrapper"""
    
    def __init__(self, api_key: Optional[str] = None, sender_email: Optional[str] = None, sender_name: Optional[str] = None):
        """
        Initialize email service with SendGrid credentials
        
        Args:
            api_key: SendGrid API key (defaults to env variable)
            sender_email: Verified sender email (defaults to env variable)
            sender_name: Display name for sender (defaults to env variable)
        """
        self.api_key = api_key or os.getenv('SENDGRID_API_KEY')
        self.sender_email = sender_email or os.getenv('SENDGRID_SENDER_EMAIL')
        self.sender_name = sender_name or os.getenv('SENDGRID_SENDER_NAME', 'TrainSmart')
        
        if not self.api_key or not self.sender_email:
            logger.warning("SendGrid credentials not configured. Email functionality will be disabled.")
            self.enabled = False
        else:
            self.enabled = True
            self.client = SendGridAPIClient(self.api_key)
    
    async def send_email(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str = None,
        text_content: str = None
    ) -> bool:
        """
        Send an email via SendGrid
        
        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_content: HTML version of email content
            text_content: Plain text version (optional)
            
        Returns:
            bool: True if email sent successfully
            
        Raises:
            EmailDeliveryError: If email sending fails
        """
        logger.info(f"=== EMAIL SERVICE SEND START ===")
        logger.info(f"Service enabled: {self.enabled}")
        logger.info(f"Sender email: {self.sender_email}")
        logger.info(f"Sender name: {self.sender_name}")
        logger.info(f"To email: {to_email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Has HTML content: {html_content is not None}")
        logger.info(f"Has text content: {text_content is not None}")
        
        if not self.enabled:
            logger.error("Email service not configured. Cannot send email.")
            raise EmailDeliveryError("Email service not configured")
        
        try:
            logger.info("Creating Mail object...")
            message = Mail(
                from_email=Email(self.sender_email, self.sender_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", html_content) if html_content else None
            )
            
            if text_content:
                logger.info("Adding plain text content...")
                message.plain_text_content = Content("text/plain", text_content)
            
            logger.info("Sending email via SendGrid client...")
            response = self.client.send(message)
            logger.info(f"SendGrid response status code: {response.status_code}")
            logger.info(f"SendGrid response body: {response.body}")
            logger.info(f"SendGrid response headers: {response.headers}")
            
            if response.status_code in [200, 202]:
                logger.info(f"Email sent successfully to {to_email}")
                return True
            else:
                logger.error(f"Failed to send email. Status code: {response.status_code}")
                raise EmailDeliveryError(f"SendGrid returned status code {response.status_code}")
                
        except EmailDeliveryError:
            raise
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}", exc_info=True)
            raise EmailDeliveryError(f"Failed to send email: {str(e)}")
    
    async def send_password_reset_email(self, to_email: str, reset_token: str, reset_url: str) -> bool:
        """
        Send password reset email
        
        Args:
            to_email: Recipient email
            reset_token: Password reset token
            reset_url: Base URL for password reset
            
        Returns:
            bool: True if sent successfully
        """
        subject = "Reset Your TrainSmart Password"
        
        # Include both email and token in the URL for better UX
        from urllib.parse import quote
        full_reset_url = f"{reset_url}?email={quote(to_email)}&token={reset_token}"
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Password Reset Request</h1>
                </div>
                <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; color: #333;">Hi there,</p>
                    <p style="font-size: 16px; color: #333;">
                        We received a request to reset your password for your TrainSmart account.
                    </p>
                    <p style="font-size: 16px; color: #333;">
                        Click the button below to reset your password:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{full_reset_url}" 
                           style="background: #00C2A8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p style="font-size: 14px; color: #666;">
                        Or copy and paste this link into your browser:
                    </p>
                    <p style="font-size: 12px; color: #999; word-break: break-all;">
                        {full_reset_url}
                    </p>
                    <p style="font-size: 14px; color: #666; margin-top: 30px;">
                        This link will expire in 1 hour for security reasons.
                    </p>
                    <p style="font-size: 14px; color: #666;">
                        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999; text-align: center;">
                        TrainSmart - Your Personal Fitness Companion<br>
                        This is an automated message, please do not reply.
                    </p>
                </div>
            </body>
        </html>
        """
        
        plain_text = f"""
        Password Reset Request
        
        Hi there,
        
        We received a request to reset your password for your TrainSmart account.
        
        Click the link below to reset your password:
        {full_reset_url}
        
        This link will expire in 1 hour for security reasons.
        
        If you didn't request a password reset, please ignore this email.
        
        TrainSmart - Your Personal Fitness Companion
        """
        
        return await self.send_email(to_email, subject, html_content, plain_text)
    
    async def send_email_verification(self, to_email: str, verification_token: str, verification_url: str) -> bool:
        """
        Send email verification email
        
        Args:
            to_email: Recipient email
            verification_token: Email verification token
            verification_url: Base URL for email verification
            
        Returns:
            bool: True if sent successfully
        """
        subject = "Verify Your TrainSmart Email"
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Welcome to TrainSmart!</h1>
                </div>
                <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; color: #333;">Hi there,</p>
                    <p style="font-size: 16px; color: #333;">
                        Thank you for signing up for TrainSmart! We're excited to have you on board.
                    </p>
                    <p style="font-size: 16px; color: #333;">
                        Please verify your email address by clicking the button below:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{verification_url}?token={verification_token}" 
                           style="background: #00C2A8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                            Verify Email
                        </a>
                    </div>
                    <p style="font-size: 14px; color: #666;">
                        Or copy and paste this link into your browser:
                    </p>
                    <p style="font-size: 12px; color: #999; word-break: break-all;">
                        {verification_url}?token={verification_token}
                    </p>
                    <p style="font-size: 14px; color: #666; margin-top: 30px;">
                        This link will expire in 24 hours.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999; text-align: center;">
                        TrainSmart - Your Personal Fitness Companion<br>
                        This is an automated message, please do not reply.
                    </p>
                </div>
            </body>
        </html>
        """
        
        return await self.send_email(to_email, subject, html_content)
    
    async def send_welcome_email(self, to_email: str, user_name: str) -> bool:
        """
        Send welcome email to new users
        
        Args:
            to_email: Recipient email
            user_name: User's name
            
        Returns:
            bool: True if sent successfully
        """
        subject = "Welcome to TrainSmart!"
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Welcome to TrainSmart, {user_name}!</h1>
                </div>
                <div style="background: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; color: #333;">Hi {user_name},</p>
                    <p style="font-size: 16px; color: #333;">
                        We're thrilled to have you join the TrainSmart community! Get ready to take your fitness journey to the next level.
                    </p>
                    <h2 style="color: #667eea; margin-top: 30px;">Getting Started:</h2>
                    <ul style="font-size: 14px; color: #666; line-height: 1.8;">
                        <li>Complete your profile to get personalized recommendations</li>
                        <li>Set your fitness goals and track your progress</li>
                        <li>Explore our AI-powered coaching features</li>
                        <li>Join the community and connect with other athletes</li>
                    </ul>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://trainsmart.app/dashboard" 
                           style="background: #00C2A8; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                            Go to Dashboard
                        </a>
                    </div>
                    <p style="font-size: 14px; color: #666;">
                        If you have any questions or need help getting started, feel free to reach out to our support team.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="font-size: 12px; color: #999; text-align: center;">
                        TrainSmart - Your Personal Fitness Companion<br>
                        This is an automated message, please do not reply.
                    </p>
                </div>
            </body>
        </html>
        """
        
        return await self.send_email(to_email, subject, html_content)


# Global email service instance
email_service = EmailService()


def get_email_service() -> EmailService:
    """Get the global email service instance"""
    return email_service


def initialize_email_service(api_key: str, sender_email: str, sender_name: str = "TrainSmart"):
    """
    Initialize or reinitialize the email service with new credentials
    
    Args:
        api_key: SendGrid API key
        sender_email: Verified sender email
        sender_name: Display name for sender
    """
    global email_service
    email_service = EmailService(api_key, sender_email, sender_name)
    return email_service
